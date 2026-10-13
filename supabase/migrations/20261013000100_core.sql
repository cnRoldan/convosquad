begin;

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
commit;
