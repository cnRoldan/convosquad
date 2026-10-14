-- ConvoSquad: inicialización de un proyecto Supabase nuevo.
-- Fuente: commit 6d4a31370f2a9891b4ad6283cf5eda1f1e801fc5.
-- No incluye fixtures de pruebas. Ejecutar una sola vez, como script completo.

begin;

-- 20261013000100_core.sql
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.club_role as enum ('admin', 'player');
create type public.player_position as enum ('POR', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MCO', 'MI', 'MD', 'EI', 'ED', 'DC');
create type public.call_up_status as enum ('draft', 'open', 'closed', 'cancelled');
create type public.availability_status as enum ('unanswered', 'available', 'unavailable', 'backup');
create type public.join_request_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  created_at timestamptz not null default now()
);
create unique index profiles_username_unique on public.profiles(lower(username));

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (char_length(description) <= 500),
  timezone text not null default 'Europe/Madrid',
  is_public boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.club_directory (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  name text not null,
  description text
);

create table public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.club_role not null default 'player',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index club_members_user_active on public.club_members(user_id, club_id) where is_active;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  ea_id text not null check (char_length(btrim(ea_id)) between 1 and 64),
  jersey_number smallint check (jersey_number between 1 and 99),
  position public.player_position not null,
  user_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, id),
  unique (club_id, user_id),
  foreign key (club_id, user_id) references public.club_members(club_id, user_id) on delete set null (user_id)
);
create unique index players_ea_id_unique on public.players(club_id, lower(ea_id));
create index players_club_active on public.players(club_id) where is_active;

create table public.call_ups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  starts_at timestamptz not null,
  local_date date not null,
  timezone text not null,
  status public.call_up_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, local_date),
  unique (club_id, id)
);
create index call_ups_club_status_date on public.call_ups(club_id, status, starts_at);

create table public.call_up_players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  call_up_id uuid not null,
  source_player_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  ea_id_snapshot text not null,
  jersey_number_snapshot smallint,
  position_snapshot public.player_position not null,
  availability public.availability_status not null default 'unanswered',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_up_id, source_player_id),
  foreign key (club_id, call_up_id) references public.call_ups(club_id, id) on delete cascade,
  foreign key (club_id, source_player_id) references public.players(club_id, id) on delete set null (source_player_id),
  check ((availability = 'unanswered' and responded_at is null) or (availability <> 'unanswered' and responded_at is not null))
);
create index call_up_players_user on public.call_up_players(user_id, call_up_id);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  check ((status = 'pending' and decided_at is null) or (status <> 'pending' and decided_at is not null))
);
create unique index join_requests_one_pending on public.join_requests(club_id, user_id) where status = 'pending';
create index join_requests_user on public.join_requests(user_id);

create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_uses integer not null default 1 check (max_uses between 1 and 100),
  uses integer not null default 0 check (uses between 0 and max_uses),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index club_invitations_club on public.club_invitations(club_id);

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username) values (new.id, btrim(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;
create trigger create_profile_after_signup after insert on auth.users for each row execute function private.create_profile();

create function private.validate_club_timezone() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.timezone <> old.timezone
    and exists (select 1 from public.call_ups where club_id = old.id) then
    raise exception 'Timezone cannot change after the first call-up' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger validate_club_timezone before insert or update of timezone on public.clubs for each row execute function private.validate_club_timezone();

create function private.sync_club_directory() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public then
    insert into public.club_directory(club_id, name, description) values (new.id, new.name, new.description)
    on conflict (club_id) do update set name = excluded.name, description = excluded.description;
  else
    delete from public.club_directory where club_id = new.id;
  end if;
  return new;
end;
$$;
create trigger sync_club_directory after insert or update of name, description, is_public on public.clubs for each row execute function private.sync_club_directory();

create function private.stamp_call_up() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select c.timezone into new.timezone from public.clubs c where c.id = new.club_id;
    new.created_by := auth.uid();
  end if;
  new.local_date := (new.starts_at at time zone new.timezone)::date;
  new.updated_at := now();
  return new;
end;
$$;
create trigger stamp_call_up before insert or update on public.call_ups for each row execute function private.stamp_call_up();

create function private.lock_membership_club() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform 1 from public.clubs where id = old.club_id for update;
    return old;
  end if;
  perform 1 from public.clubs where id = new.club_id for update;
  return new;
end;
$$;
create trigger lock_membership_club before insert or update or delete on public.club_members for each row execute function private.lock_membership_club();

create function private.ensure_club_admin() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  if tg_op = 'DELETE' then v_club_id := old.club_id; else v_club_id := new.club_id; end if;
  if exists (select 1 from public.clubs where id = v_club_id)
    and not exists (select 1 from public.club_members where club_id = v_club_id and is_active and role = 'admin') then
    raise exception 'A club requires at least one active admin' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger ensure_club_admin after insert or update or delete on public.club_members deferrable initially deferred for each row execute function private.ensure_club_admin();

revoke all on all functions in schema private from public, anon, authenticated;

-- 20261013000200_security.sql
create function private.is_member(p_club_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = p_club_id and m.user_id = (select auth.uid()) and m.is_active);
$$;
create function private.is_admin(p_club_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = p_club_id and m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin');
$$;
create function private.shares_club(p_user_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_members mine join public.club_members theirs on theirs.club_id = mine.club_id
    where mine.user_id = (select auth.uid()) and mine.is_active and theirs.user_id = p_user_id and theirs.is_active
  );
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_member(uuid), private.is_admin(uuid), private.shares_club(uuid) from public, anon;
grant execute on function private.is_member(uuid), private.is_admin(uuid), private.shares_club(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_directory enable row level security;
alter table public.club_members enable row level security;
alter table public.players enable row level security;
alter table public.call_ups enable row level security;
alter table public.call_up_players enable row level security;
alter table public.join_requests enable row level security;
alter table public.club_invitations enable row level security;

revoke all on public.profiles, public.clubs, public.club_directory, public.club_members, public.players,
  public.call_ups, public.call_up_players, public.join_requests, public.club_invitations from public, anon, authenticated;

grant select on public.profiles, public.clubs, public.club_members, public.players, public.call_ups, public.call_up_players, public.join_requests to authenticated;
grant select on public.club_directory to anon, authenticated;
grant select (id, club_id, expires_at, revoked_at, max_uses, uses, created_by, created_at) on public.club_invitations to authenticated;
grant update (username) on public.profiles to authenticated;
grant update (name, description, timezone, is_public) on public.clubs to authenticated;
grant insert (club_id, ea_id, jersey_number, position, is_active) on public.players to authenticated;
grant update (ea_id, jersey_number, position, is_active) on public.players to authenticated;
grant delete on public.players to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.shares_club(id));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy clubs_read on public.clubs for select to authenticated using (private.is_member(id));
create policy clubs_update_admin on public.clubs for update to authenticated using (private.is_admin(id)) with check (private.is_admin(id));
create policy directory_read on public.club_directory for select to anon, authenticated using (true);
create policy members_read on public.club_members for select to authenticated using (private.is_admin(club_id) or (is_active and private.is_member(club_id)));
create policy players_read on public.players for select to authenticated using (private.is_member(club_id));
create policy players_insert_admin on public.players for insert to authenticated with check (private.is_admin(club_id) and user_id is null);
create policy players_update_admin on public.players for update to authenticated using (private.is_admin(club_id)) with check (private.is_admin(club_id));
create policy players_delete_admin on public.players for delete to authenticated using (private.is_admin(club_id));
create policy call_ups_read on public.call_ups for select to authenticated using (private.is_admin(club_id) or (status = 'open' and private.is_member(club_id)));
create policy call_ups_update_admin on public.call_ups for update to authenticated using (private.is_admin(club_id)) with check (private.is_admin(club_id));
create policy call_up_players_read on public.call_up_players for select to authenticated using (
  exists (select 1 from public.call_ups c where c.id = call_up_id and c.club_id = call_up_players.club_id)
);
create policy join_requests_read on public.join_requests for select to authenticated using (user_id = (select auth.uid()) or private.is_admin(club_id));
create policy invitations_read_admin on public.club_invitations for select to authenticated using (private.is_admin(club_id));


-- 20261013000300_operations.sql
create function private.require_user() returns uuid language plpgsql stable set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return v_user;
end;
$$;
create function private.require_admin(p_club_id uuid) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.is_admin(p_club_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
end;
$$;

create function public.create_club(p_name text, p_description text default null, p_timezone text default 'Europe/Madrid', p_is_public boolean default false)
returns public.clubs language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_club public.clubs;
begin
  insert into public.clubs(name, description, timezone, is_public, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_timezone, p_is_public, v_user) returning * into v_club;
  insert into public.club_members(club_id, user_id, role) values (v_club.id, v_user, 'admin');
  return v_club;
end;
$$;

create function public.set_club_member(p_club_id uuid, p_user_id uuid, p_role public.club_role, p_is_active boolean)
returns public.club_members language plpgsql security definer set search_path = '' as $$
declare v_member public.club_members;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  select * into v_member from public.club_members where club_id = p_club_id and user_id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = '22023'; end if;
  if v_member.role = 'admin' and v_member.is_active and (p_role <> 'admin' or not p_is_active)
    and (select count(*) from public.club_members where club_id = p_club_id and role = 'admin' and is_active) = 1 then
    raise exception 'Cannot remove the last active admin' using errcode = '23514';
  end if;
  update public.club_members set role = p_role, is_active = p_is_active where id = v_member.id returning * into v_member;
  return v_member;
end;
$$;

create function private.link_player(p_club_id uuid, p_player_id uuid, p_user_id uuid)
returns public.players language plpgsql security definer set search_path = '' as $$
declare v_player public.players;
begin
  if not exists (select 1 from public.club_members where club_id = p_club_id and user_id = p_user_id and is_active) then
    raise exception 'An active membership is required' using errcode = '22023';
  end if;
  select * into v_player from public.players where id = p_player_id and club_id = p_club_id for update;
  if not found then raise exception 'Player not found' using errcode = '22023'; end if;
  if v_player.user_id is not null and v_player.user_id <> p_user_id then
    raise exception 'Player already linked' using errcode = '23505';
  end if;
  update public.players set user_id = p_user_id where id = v_player.id returning * into v_player;
  update public.call_up_players s set user_id = p_user_id, updated_at = now()
  from public.call_ups c where s.call_up_id = c.id and s.club_id = p_club_id and s.source_player_id = p_player_id
    and s.user_id is null and c.status in ('draft', 'open');
  return v_player;
end;
$$;
create function public.link_player_account(p_player_id uuid, p_user_id uuid)
returns public.players language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from public.players where id = p_player_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  return private.link_player(v_club_id, p_player_id, p_user_id);
end;
$$;

create function public.request_to_join(p_club_id uuid)
returns public.join_requests language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_request public.join_requests;
begin
  if not exists (select 1 from public.clubs where id = p_club_id and is_public) then
    raise exception 'Club not available for requests' using errcode = '42501';
  end if;
  if private.is_member(p_club_id) then raise exception 'Already an active member' using errcode = '22023'; end if;
  insert into public.join_requests(club_id, user_id) values (p_club_id, v_user) returning * into v_request;
  return v_request;
end;
$$;

create function public.review_join_request(p_request_id uuid, p_approve boolean, p_player_id uuid default null)
returns public.join_requests language plpgsql security definer set search_path = '' as $$
declare v_request public.join_requests; v_club_id uuid; v_user uuid := private.require_user();
begin
  select club_id into v_club_id from public.join_requests where id = p_request_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  select * into v_request from public.join_requests where id = p_request_id for update;
  if v_request.status <> 'pending' then raise exception 'Request already resolved' using errcode = '22023'; end if;
  if p_approve then
    insert into public.club_members(club_id, user_id) values (v_request.club_id, v_request.user_id)
    on conflict (club_id, user_id) do update set is_active = true,
      role = case when club_members.is_active then club_members.role else 'player'::public.club_role end;
    if p_player_id is not null then perform private.link_player(v_club_id, p_player_id, v_request.user_id); end if;
  elsif p_player_id is not null then
    raise exception 'Cannot link a rejected request' using errcode = '22023';
  end if;
  update public.join_requests set status = case when p_approve then 'approved'::public.join_request_status else 'rejected'::public.join_request_status end,
    decided_at = now(), decided_by = v_user where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

create function public.create_call_up(p_club_id uuid, p_starts_at timestamptz, p_status public.call_up_status default 'draft')
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_call_up public.call_ups;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_status not in ('draft', 'open') then raise exception 'Initial status must be draft or open' using errcode = '22023'; end if;
  insert into public.call_ups(club_id, starts_at, status) values (p_club_id, p_starts_at, p_status) returning * into v_call_up;
  insert into public.call_up_players(club_id, call_up_id, source_player_id, user_id, ea_id_snapshot, jersey_number_snapshot, position_snapshot)
  select p_club_id, v_call_up.id, p.id, case when m.is_active then p.user_id end, p.ea_id, p.jersey_number, p.position
  from public.players p left join public.club_members m on m.club_id = p.club_id and m.user_id = p.user_id
  where p.club_id = p_club_id and p.is_active;
  return v_call_up;
end;
$$;

create function public.update_call_up(p_call_up_id uuid, p_starts_at timestamptz, p_status public.call_up_status)
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid; v_call_up public.call_ups;
begin
  select club_id into v_club_id from public.call_ups where id = p_call_up_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  update public.call_ups set starts_at = p_starts_at, status = p_status where id = p_call_up_id returning * into v_call_up;
  return v_call_up;
end;
$$;

create function public.respond_to_call_up(p_call_up_player_id uuid, p_availability public.availability_status)
returns public.call_up_players language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_entry public.call_up_players; v_status public.call_up_status; v_club_id uuid;
begin
  select c.club_id into v_club_id from public.call_up_players s join public.call_ups c on c.id = s.call_up_id where s.id = p_call_up_player_id;
  perform 1 from public.clubs where id = v_club_id for update;
  select c.status into v_status from public.call_ups c join public.call_up_players s on s.call_up_id = c.id where s.id = p_call_up_player_id for update of c;
  select * into v_entry from public.call_up_players where id = p_call_up_player_id for update;
  if not found or v_entry.user_id is distinct from v_user or not private.is_member(v_entry.club_id) or v_status <> 'open' then
    raise exception 'Not authorized to respond' using errcode = '42501';
  end if;
  update public.call_up_players set availability = p_availability,
    responded_at = case when p_availability = 'unanswered' then null else now() end, updated_at = now()
  where id = v_entry.id returning * into v_entry;
  return v_entry;
end;
$$;

create function public.create_club_invitation(p_club_id uuid, p_expires_at timestamptz, p_max_uses integer default 1)
returns table(id uuid, token text, expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid;
begin
  perform 1 from public.clubs where clubs.id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then raise exception 'Invalid expiration' using errcode = '22023'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.club_invitations(club_id, token_hash, expires_at, max_uses, created_by)
  values (p_club_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_expires_at, p_max_uses, private.require_user()) returning club_invitations.id into v_id;
  return query select v_id, v_token, p_expires_at;
end;
$$;

create function public.revoke_club_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from public.club_invitations where id = p_invitation_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  update public.club_invitations set revoked_at = now() where id = p_invitation_id;
end;
$$;

create function public.redeem_club_invitation(p_club_id uuid, p_token text)
returns public.club_members language plpgsql security definer set search_path = '' as $$
declare v_invite public.club_invitations; v_user uuid := private.require_user(); v_member public.club_members;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitation not valid' using errcode = '22023'; end if;
  perform 1 from public.clubs where id = p_club_id for update;
  select * into v_invite from public.club_invitations where club_id = p_club_id
    and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() or v_invite.uses >= v_invite.max_uses then
    raise exception 'Invitation not valid' using errcode = '22023';
  end if;
  if private.is_member(p_club_id) then
    select * into v_member from public.club_members where club_id = p_club_id and user_id = v_user;
    return v_member;
  end if;
  insert into public.club_members(club_id, user_id) values (p_club_id, v_user)
  on conflict (club_id, user_id) do update set is_active = true, role = 'player' returning * into v_member;
  update public.club_invitations set uses = uses + 1 where club_invitations.id = v_invite.id;
  return v_member;
end;
$$;

revoke all on function private.require_user(), private.require_admin(uuid), private.link_player(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_club(text, text, text, boolean), public.set_club_member(uuid, uuid, public.club_role, boolean),
  public.link_player_account(uuid, uuid), public.request_to_join(uuid), public.review_join_request(uuid, boolean, uuid),
  public.create_call_up(uuid, timestamptz, public.call_up_status), public.update_call_up(uuid, timestamptz, public.call_up_status), public.respond_to_call_up(uuid, public.availability_status),
  public.create_club_invitation(uuid, timestamptz, integer), public.revoke_club_invitation(uuid), public.redeem_club_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.create_club(text, text, text, boolean), public.set_club_member(uuid, uuid, public.club_role, boolean),
  public.link_player_account(uuid, uuid), public.request_to_join(uuid), public.review_join_request(uuid, boolean, uuid),
  public.create_call_up(uuid, timestamptz, public.call_up_status), public.update_call_up(uuid, timestamptz, public.call_up_status), public.respond_to_call_up(uuid, public.availability_status),
  public.create_club_invitation(uuid, timestamptz, integer), public.revoke_club_invitation(uuid), public.redeem_club_invitation(uuid, text) to authenticated;


-- 20261013190000_club_workflows.sql
alter table public.join_requests add column club_name_snapshot text not null default 'Club solicitado';
update public.join_requests r set club_name_snapshot = c.name from public.clubs c where c.id = r.club_id and c.is_public;

create function private.can_review_profile(p_user_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.join_requests r join public.club_members m on m.club_id = r.club_id
    where r.user_id = p_user_id and r.status = 'pending' and m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin'
  );
$$;
revoke all on function private.can_review_profile(uuid) from public, anon, authenticated;
grant execute on function private.can_review_profile(uuid) to authenticated;
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or private.shares_club(id) or private.can_review_profile(id)
);

create or replace function public.request_to_join(p_club_id uuid)
returns public.join_requests language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_request public.join_requests; v_name text;
begin
  select name into v_name from public.clubs where id = p_club_id and is_public for share;
  if not found then raise exception 'Club not available for requests' using errcode = '42501'; end if;
  if private.is_member(p_club_id) then raise exception 'Already an active member' using errcode = '22023'; end if;
  insert into public.join_requests(club_id, user_id, club_name_snapshot) values (p_club_id, v_user, v_name) returning * into v_request;
  return v_request;
end;
$$;

create function public.search_clubs(p_query text)
returns setof public.club_directory language sql stable security invoker set search_path = '' as $$
  select d.club_id, d.name, d.description from public.club_directory d
  where position(lower(left(btrim(coalesce(p_query, '')), 80)) in lower(d.name)) > 0 order by d.name limit 50;
$$;
revoke all on function public.search_clubs(text) from public, anon, authenticated;
grant execute on function public.search_clubs(text) to anon, authenticated;

DO $$
begin
  if exists (select 1 from public.players group by club_id, lower(btrim(ea_id)) having count(*) > 1) then
    raise exception 'Resolve existing EA ID duplicates before applying this migration' using errcode = '23505';
  end if;
end;
$$;
update public.players set ea_id = btrim(ea_id) where ea_id <> btrim(ea_id);
create function private.normalize_player_ea_id() returns trigger language plpgsql set search_path = '' as $$
begin
  new.ea_id := btrim(new.ea_id);
  return new;
end;
$$;
create trigger normalize_player_ea_id before insert or update of ea_id on public.players for each row execute function private.normalize_player_ea_id();
revoke all on function private.normalize_player_ea_id() from public, anon, authenticated;

create function public.import_players(p_club_id uuid, p_players jsonb)
returns setof public.players language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_player public.players;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_players is null or jsonb_typeof(p_players) <> 'array' then raise exception 'Invalid import payload' using errcode = '22023'; end if;
  if jsonb_array_length(p_players) not between 1 and 100 then raise exception 'Import requires 1 to 100 players' using errcode = '22023'; end if;
  for v_item in select value from jsonb_array_elements(p_players) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Invalid player' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in ('ea_id', 'jersey_number', 'position')) then
      raise exception 'Unexpected player fields' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'ea_id') is distinct from 'string' or jsonb_typeof(v_item -> 'position') is distinct from 'string'
      or jsonb_typeof(v_item -> 'jersey_number') is distinct from 'number'
      or (v_item ->> 'jersey_number') !~ '^[1-9][0-9]?$' then
      raise exception 'Invalid player fields' using errcode = '22023';
    end if;
    insert into public.players(club_id, ea_id, jersey_number, position)
    values (p_club_id, v_item ->> 'ea_id', (v_item ->> 'jersey_number')::smallint, (v_item ->> 'position')::public.player_position)
    returning * into v_player;
    return next v_player;
  end loop;
  return;
end;
$$;
revoke all on function public.import_players(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_players(uuid, jsonb) to authenticated;

create function public.create_invitation_for_hours(p_club_id uuid, p_hours integer, p_max_uses integer default 1)
returns table(id uuid, token text, expires_at timestamptz) language plpgsql security invoker set search_path = '' as $$
begin
  if p_hours is null or p_hours not between 1 and 720 then raise exception 'Invalid lifetime' using errcode = '22023'; end if;
  return query select * from public.create_club_invitation(p_club_id, now() + p_hours * interval '1 hour', p_max_uses);
end;
$$;
revoke all on function public.create_invitation_for_hours(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.create_invitation_for_hours(uuid, integer, integer) to authenticated;


commit;
