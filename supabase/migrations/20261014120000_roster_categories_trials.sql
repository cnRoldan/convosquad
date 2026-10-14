begin;

create type public.roster_category as enum ('goalkeepers', 'centre_backs', 'wide_backs', 'midfielders', 'attackers', 'backups');
create type public.trial_status as enum ('active', 'withdrawn', 'incorporated');
create function private.category_from_position(p_position public.player_position) returns public.roster_category
language sql immutable set search_path = '' as $$
  select case p_position when 'POR' then 'goalkeepers' when 'DFC' then 'centre_backs'
    when 'LI' then 'wide_backs' when 'LD' then 'wide_backs'
    when 'EI' then 'attackers' when 'ED' then 'attackers' when 'DC' then 'attackers'
    when 'MCD' then 'midfielders' when 'MC' then 'midfielders' when 'MCO' then 'midfielders'
    when 'MI' then 'midfielders' when 'MD' then 'midfielders' else null end::public.roster_category;
$$;
revoke all on function private.category_from_position(public.player_position) from public, anon, authenticated;

alter table public.players add column category public.roster_category, add column sort_order integer;
update public.players set category = private.category_from_position(position);
with ranked as (select id, row_number() over (partition by club_id, category order by jersey_number nulls last, lower(ea_id), id) - 1 as ordinal from public.players)
update public.players p set sort_order = r.ordinal from ranked r where r.id = p.id;
alter table public.players alter column category set not null, alter column sort_order set not null,
  alter column position set default 'MC', alter column sort_order set default 0, add constraint players_order_nonnegative check (sort_order >= 0);
create index players_category_order on public.players(club_id, category, sort_order, id);
grant insert (category) on public.players to authenticated;
grant update (category) on public.players to authenticated;

create function private.assign_player_category() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.clubs where id = new.club_id for update;
  if tg_op = 'INSERT' then
    new.category := coalesce(new.category, private.category_from_position(new.position));
    select coalesce(max(sort_order) + 1, 0) into new.sort_order from public.players where club_id = new.club_id and category = new.category;
  else
    if new.category = old.category and new.position <> old.position then new.category := private.category_from_position(new.position); end if;
    if new.category <> old.category or (new.is_active and not old.is_active) then
      select coalesce(max(sort_order) + 1, 0) into new.sort_order from public.players where club_id = new.club_id and category = new.category;
    end if;
  end if;
  return new;
end;
$$;
create trigger assign_player_category before insert or update on public.players for each row execute function private.assign_player_category();
revoke all on function private.assign_player_category() from public, anon, authenticated;

alter table public.call_up_players add column category_snapshot public.roster_category, add column sort_order_snapshot integer;
update public.call_up_players set category_snapshot = private.category_from_position(position_snapshot);
with ranked as (select id, row_number() over (partition by call_up_id, category_snapshot order by jersey_number_snapshot nulls last, lower(ea_id_snapshot), id) - 1 as ordinal from public.call_up_players)
update public.call_up_players p set sort_order_snapshot = r.ordinal from ranked r where r.id = p.id;
alter table public.call_up_players alter column category_snapshot set not null, alter column sort_order_snapshot set not null,
  alter column category_snapshot set default 'midfielders', alter column sort_order_snapshot set default 0,
  add constraint call_up_players_order_nonnegative check (sort_order_snapshot >= 0);

create table public.club_trials (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  ea_id text not null check (char_length(btrim(ea_id)) between 1 and 64),
  jersey_number smallint check (jersey_number between 1 and 99),
  position text check (char_length(position) <= 80),
  notes text check (char_length(notes) <= 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  status public.trial_status not null default 'active',
  player_id uuid,
  created_at timestamptz not null default now(),
  incorporated_at timestamptz,
  unique (club_id, id),
  foreign key (club_id, player_id) references public.players(club_id, id) on delete set null (player_id),
  check ((status = 'incorporated') = (incorporated_at is not null))
);
create unique index club_trials_active_ea_unique on public.club_trials(club_id, lower(ea_id)) where status = 'active';
create index club_trials_order on public.club_trials(club_id, status, sort_order, id);
create function private.stamp_trial() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.clubs where id = new.club_id for update;
  new.ea_id := btrim(new.ea_id);
  if tg_op = 'INSERT' then
    select coalesce(max(sort_order) + 1, 0) into new.sort_order from public.club_trials where club_id = new.club_id;
  end if;
  return new;
end;
$$;
create trigger stamp_trial before insert or update on public.club_trials for each row execute function private.stamp_trial();
revoke all on function private.stamp_trial() from public, anon, authenticated;

create table public.call_up_trials (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  call_up_id uuid not null,
  source_trial_id uuid,
  ea_id_snapshot text not null,
  jersey_number_snapshot smallint,
  position_snapshot text,
  notes_snapshot text,
  sort_order_snapshot integer not null check (sort_order_snapshot >= 0),
  trial_created_at timestamptz not null,
  foreign key (club_id, call_up_id) references public.call_ups(club_id, id) on delete cascade,
  foreign key (club_id, source_trial_id) references public.club_trials(club_id, id) on delete set null (source_trial_id),
  unique (call_up_id, source_trial_id)
);
create index call_up_trials_order on public.call_up_trials(call_up_id, sort_order_snapshot, id);
create table public.call_up_aids (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  call_up_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  foreign key (club_id, call_up_id) references public.call_ups(club_id, id) on delete cascade
);
create index call_up_aids_order on public.call_up_aids(call_up_id, sort_order, id);
create function private.can_manage_call_up(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.call_ups c where c.id = p_id and c.status in ('draft', 'open') and private.is_admin(c.club_id));
$$;
revoke all on function private.can_manage_call_up(uuid) from public, anon, authenticated;
grant execute on function private.can_manage_call_up(uuid) to authenticated;
create function private.stamp_aid() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_call uuid;
begin
  if tg_op = 'DELETE' then v_club := old.club_id; v_call := old.call_up_id; else v_club := new.club_id; v_call := new.call_up_id; end if;
  perform 1 from public.clubs where id = v_club for update;
  if tg_op = 'DELETE' and not exists (select 1 from public.call_ups where id = v_call) then return old; end if;
  perform 1 from public.call_ups where id = v_call and club_id = v_club and status in ('draft', 'open') for update;
  if not found then raise exception 'Call-up is immutable or mismatched' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if;
  new.body := btrim(new.body);
  if tg_op = 'INSERT' then
    select coalesce(max(sort_order) + 1, 0) into new.sort_order from public.call_up_aids where call_up_id = new.call_up_id;
  end if;
  return new;
end;
$$;
create trigger stamp_aid before insert or update or delete on public.call_up_aids for each row execute function private.stamp_aid();
revoke all on function private.stamp_aid() from public, anon, authenticated;

alter table public.club_trials enable row level security;
alter table public.call_up_trials enable row level security;
alter table public.call_up_aids enable row level security;
revoke all on public.club_trials, public.call_up_trials, public.call_up_aids from public, anon, authenticated;
grant select on public.club_trials, public.call_up_trials, public.call_up_aids to authenticated;
grant insert (club_id, ea_id, jersey_number, position, notes) on public.club_trials to authenticated;
grant update (ea_id, jersey_number, position, notes) on public.club_trials to authenticated;
grant insert (club_id, call_up_id, body) on public.call_up_aids to authenticated;
grant update (body) on public.call_up_aids to authenticated;
grant delete on public.call_up_aids to authenticated;
create policy trials_read on public.club_trials for select to authenticated using (private.is_member(club_id));
create policy trials_insert on public.club_trials for insert to authenticated with check (private.is_admin(club_id) and status = 'active' and player_id is null);
create policy trials_update on public.club_trials for update to authenticated using (private.is_admin(club_id) and status = 'active') with check (private.is_admin(club_id) and status = 'active');
create policy trial_snapshots_read on public.call_up_trials for select to authenticated using (exists (select 1 from public.call_ups c where c.id = call_up_id and c.club_id = call_up_trials.club_id));
create policy aids_read on public.call_up_aids for select to authenticated using (exists (select 1 from public.call_ups c where c.id = call_up_id and c.club_id = call_up_aids.club_id));
create policy aids_insert on public.call_up_aids for insert to authenticated with check (private.is_admin(club_id) and private.can_manage_call_up(call_up_id));
create policy aids_update on public.call_up_aids for update to authenticated using (private.is_admin(club_id) and private.can_manage_call_up(call_up_id)) with check (private.is_admin(club_id) and private.can_manage_call_up(call_up_id));
create policy aids_delete on public.call_up_aids for delete to authenticated using (private.is_admin(club_id) and private.can_manage_call_up(call_up_id));

create function public.withdraw_trial(p_trial_id uuid) returns public.club_trials language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_trial public.club_trials;
begin
  select club_id into v_club from public.club_trials where id = p_trial_id;
  perform 1 from public.clubs where id = v_club for update;
  perform private.require_admin(v_club);
  update public.club_trials set status = 'withdrawn' where id = p_trial_id and status = 'active' returning * into v_trial;
  if not found then raise exception 'Trial is not active' using errcode = '22023'; end if;
  return v_trial;
end;
$$;
create function public.promote_trial(p_trial_id uuid, p_category public.roster_category, p_existing_player_id uuid default null)
returns public.players language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_trial public.club_trials; v_player public.players;
begin
  select club_id into v_club from public.club_trials where id = p_trial_id;
  perform 1 from public.clubs where id = v_club for update;
  perform private.require_admin(v_club);
  select * into v_trial from public.club_trials where id = p_trial_id and status = 'active' for update;
  if not found or p_category is null then raise exception 'Trial is not active or category missing' using errcode = '22023'; end if;
  if p_existing_player_id is null then
    insert into public.players(club_id, ea_id, jersey_number, category) values (v_club, v_trial.ea_id, v_trial.jersey_number, p_category) returning * into v_player;
  else
    select * into v_player from public.players where id = p_existing_player_id and club_id = v_club for update;
    if not found or lower(btrim(v_player.ea_id)) <> lower(v_trial.ea_id) then raise exception 'Existing player does not match this trial' using errcode = '22023'; end if;
    update public.players set category = p_category, jersey_number = coalesce(jersey_number, v_trial.jersey_number), is_active = true where id = v_player.id returning * into v_player;
  end if;
  update public.club_trials set status = 'incorporated', player_id = v_player.id, incorporated_at = now() where id = v_trial.id;
  return v_player;
end;
$$;

create function private.reorder_roster_items(p_kind text, p_scope uuid, p_category public.roster_category, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_expected uuid[]; v_received uuid[];
begin
  if p_kind = 'aids' then select club_id into v_club from public.call_ups where id = p_scope; else v_club := p_scope; end if;
  perform 1 from public.clubs where id = v_club for update;
  perform private.require_admin(v_club);
  if p_kind = 'aids' and not private.can_manage_call_up(p_scope) then raise exception 'Call-up is immutable' using errcode = '42501'; end if;
  if p_kind = 'players' then select array_agg(id order by id) into v_expected from public.players where club_id = p_scope and category = p_category and is_active;
  elsif p_kind = 'trials' then select array_agg(id order by id) into v_expected from public.club_trials where club_id = p_scope and status = 'active';
  elsif p_kind = 'aids' then select array_agg(id order by id) into v_expected from public.call_up_aids where call_up_id = p_scope;
  else raise exception 'Invalid reorder scope' using errcode = '22023'; end if;
  select array_agg(x order by x) into v_received from unnest(p_ids) x;
  if p_ids is null or cardinality(p_ids) = 0 or v_received is distinct from v_expected then raise exception 'Order must contain each item exactly once' using errcode = '22023'; end if;
  if p_kind = 'players' then update public.players p set sort_order = x.ordinal - 1 from unnest(p_ids) with ordinality x(id, ordinal) where p.id = x.id;
  elsif p_kind = 'trials' then update public.club_trials p set sort_order = x.ordinal - 1 from unnest(p_ids) with ordinality x(id, ordinal) where p.id = x.id;
  else update public.call_up_aids p set sort_order = x.ordinal - 1 from unnest(p_ids) with ordinality x(id, ordinal) where p.id = x.id;
  end if;
end;
$$;
revoke all on function private.reorder_roster_items(text, uuid, public.roster_category, uuid[]) from public, anon, authenticated;
create function public.reorder_players(p_club_id uuid, p_category public.roster_category, p_ids uuid[]) returns void language sql security definer set search_path = '' as $$ select private.reorder_roster_items('players', p_club_id, p_category, p_ids); $$;
create function public.reorder_trials(p_club_id uuid, p_ids uuid[]) returns void language sql security definer set search_path = '' as $$ select private.reorder_roster_items('trials', p_club_id, null, p_ids); $$;
create function public.reorder_aids(p_call_up_id uuid, p_ids uuid[]) returns void language sql security definer set search_path = '' as $$ select private.reorder_roster_items('aids', p_call_up_id, null, p_ids); $$;

create or replace function public.create_call_up(p_club_id uuid, p_starts_at timestamptz, p_status public.call_up_status default 'draft')
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_call_up public.call_ups;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_status not in ('draft', 'open') then raise exception 'Initial status must be draft or open' using errcode = '22023'; end if;
  insert into public.call_ups(club_id, starts_at, status) values (p_club_id, p_starts_at, p_status) returning * into v_call_up;
  insert into public.call_up_players(club_id, call_up_id, source_player_id, user_id, ea_id_snapshot, jersey_number_snapshot, position_snapshot, category_snapshot, sort_order_snapshot)
  select p_club_id, v_call_up.id, p.id, case when m.is_active then p.user_id end, p.ea_id, p.jersey_number, p.position, p.category, p.sort_order
    from public.players p left join public.club_members m on m.club_id = p.club_id and m.user_id = p.user_id where p.club_id = p_club_id and p.is_active;
  insert into public.call_up_trials(club_id, call_up_id, source_trial_id, ea_id_snapshot, jersey_number_snapshot, position_snapshot, notes_snapshot, sort_order_snapshot, trial_created_at)
    select p_club_id, v_call_up.id, id, ea_id, jersey_number, position, notes, sort_order, created_at from public.club_trials where club_id = p_club_id and status = 'active';
  return v_call_up;
end;
$$;

create function public.import_roster(p_club_id uuid, p_players jsonb, p_trials jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_players integer; v_trials integer;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if jsonb_typeof(p_players) is distinct from 'array' or jsonb_typeof(p_trials) is distinct from 'array' then raise exception 'Invalid import arrays' using errcode = '22023'; end if;
  v_players := jsonb_array_length(p_players); v_trials := jsonb_array_length(p_trials);
  if v_players + v_trials not between 1 and 100 then raise exception 'Import requires 1 to 100 rows' using errcode = '22023'; end if;
  for v_item in select value from jsonb_array_elements(p_players) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Invalid player' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in ('ea_id', 'jersey_number', 'category'))
      or jsonb_typeof(v_item -> 'ea_id') is distinct from 'string' or jsonb_typeof(v_item -> 'category') is distinct from 'string' then raise exception 'Invalid player fields' using errcode = '22023'; end if;
    if v_item ? 'jersey_number' and jsonb_typeof(v_item -> 'jersey_number') not in ('number', 'null') then raise exception 'Invalid jersey' using errcode = '22023'; end if;
    if jsonb_typeof(v_item -> 'jersey_number') = 'number' and (v_item ->> 'jersey_number') !~ '^[1-9][0-9]?$' then raise exception 'Invalid jersey' using errcode = '22023'; end if;
    if exists (select 1 from public.club_trials where club_id = p_club_id and status = 'active' and lower(ea_id) = lower(btrim(v_item ->> 'ea_id'))) then raise exception 'EA ID already has an active trial' using errcode = '23505'; end if;
    insert into public.players(club_id, ea_id, jersey_number, category) values (p_club_id, v_item ->> 'ea_id', (v_item ->> 'jersey_number')::smallint, (v_item ->> 'category')::public.roster_category);
  end loop;
  for v_item in select value from jsonb_array_elements(p_trials) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Invalid trial' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in ('ea_id', 'jersey_number', 'position', 'notes'))
      or jsonb_typeof(v_item -> 'ea_id') is distinct from 'string' then raise exception 'Invalid trial fields' using errcode = '22023'; end if;
    if v_item ? 'jersey_number' and jsonb_typeof(v_item -> 'jersey_number') not in ('number', 'null') then raise exception 'Invalid jersey' using errcode = '22023'; end if;
    if jsonb_typeof(v_item -> 'jersey_number') = 'number' and (v_item ->> 'jersey_number') !~ '^[1-9][0-9]?$' then raise exception 'Invalid jersey' using errcode = '22023'; end if;
    if (v_item ? 'position' and jsonb_typeof(v_item -> 'position') not in ('string', 'null')) or (v_item ? 'notes' and jsonb_typeof(v_item -> 'notes') not in ('string', 'null')) then raise exception 'Invalid trial text' using errcode = '22023'; end if;
    if exists (select 1 from public.players where club_id = p_club_id and lower(ea_id) = lower(btrim(v_item ->> 'ea_id'))) then raise exception 'EA ID already exists in roster' using errcode = '23505'; end if;
    insert into public.club_trials(club_id, ea_id, jersey_number, position, notes) values (p_club_id, v_item ->> 'ea_id', (v_item ->> 'jersey_number')::smallint, v_item ->> 'position', v_item ->> 'notes');
  end loop;
  return jsonb_build_object('players', v_players, 'trials', v_trials);
end;
$$;
revoke all on function public.withdraw_trial(uuid), public.promote_trial(uuid, public.roster_category, uuid), public.reorder_players(uuid, public.roster_category, uuid[]), public.reorder_trials(uuid, uuid[]), public.reorder_aids(uuid, uuid[]), public.import_roster(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.withdraw_trial(uuid), public.promote_trial(uuid, public.roster_category, uuid), public.reorder_players(uuid, public.roster_category, uuid[]), public.reorder_trials(uuid, uuid[]), public.reorder_aids(uuid, uuid[]), public.import_roster(uuid, jsonb, jsonb) to authenticated;

commit;
