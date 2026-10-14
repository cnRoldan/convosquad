begin;

create table public.push_devices (
  device_id uuid primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  expo_push_token text,
  platform text not null check (platform in ('android', 'ios')),
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not is_active or (user_id is not null and expo_push_token is not null)),
  check (expo_push_token is null or (char_length(expo_push_token) <= 300 and expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'))
);
create unique index push_devices_token_unique on public.push_devices(expo_push_token) where expo_push_token is not null;
create index push_devices_user_active on public.push_devices(user_id) where is_active;
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant select on public.push_devices to authenticated;
create policy push_devices_read_own on public.push_devices for select to authenticated using (user_id = (select auth.uid()));

create function public.register_push_device(p_device_id uuid, p_expo_push_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_owner uuid;
begin
  if p_device_id is null or p_platform is null or p_platform not in ('android', 'ios') or p_expo_push_token is null
    or char_length(p_expo_push_token) > 300 or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid device' using errcode = '22023';
  end if;
  -- Serializa el alta de IDs nuevos y la rotación/reutilización del mismo token.
  perform pg_advisory_xact_lock(hashtextextended(p_device_id::text, 5));
  perform pg_advisory_xact_lock(hashtextextended(p_expo_push_token, 6));
  select user_id into v_owner from public.push_devices where device_id = p_device_id for update;
  if v_owner is not null and v_owner <> v_user then raise exception 'Device belongs to another user' using errcode = '42501'; end if;
  if exists (select 1 from public.push_devices where expo_push_token = p_expo_push_token and user_id is distinct from v_user) then
    raise exception 'Token belongs to another user' using errcode = '42501';
  end if;
  update public.push_devices set is_active = false, expo_push_token = null, updated_at = now()
    where expo_push_token = p_expo_push_token and device_id <> p_device_id and user_id = v_user;
  insert into public.push_devices(device_id, user_id, expo_push_token, platform, is_active)
    values (p_device_id, v_user, p_expo_push_token, p_platform, true)
  on conflict (device_id) do update set user_id = v_user, expo_push_token = p_expo_push_token,
    platform = p_platform, is_active = true, updated_at = now();
end;
$$;

create function public.deactivate_push_device(p_device_id uuid, p_unlink boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_device public.push_devices;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_device_id::text, 5));
  select * into v_device from public.push_devices where device_id = p_device_id for update;
  if not found or (v_device.user_id is null and not v_device.is_active) then return; end if;
  if v_device.user_id is distinct from v_user then raise exception 'Not device owner' using errcode = '42501'; end if;
  update public.push_devices set is_active = false, expo_push_token = null,
    user_id = case when p_unlink then null else user_id end, updated_at = now() where device_id = p_device_id;
end;
$$;
revoke all on function public.register_push_device(uuid,text,text), public.deactivate_push_device(uuid,boolean) from public, anon, authenticated;
grant execute on function public.register_push_device(uuid,text,text), public.deactivate_push_device(uuid,boolean) to authenticated;

create table public.push_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  call_up_id uuid not null,
  event_key text not null check (char_length(event_key) between 1 and 200),
  kind text not null check (kind in ('published', 'pending')),
  created_at timestamptz not null default now(),
  unique (club_id, event_key),
  unique (id, club_id),
  foreign key (club_id,call_up_id) references public.call_ups(club_id,id) on delete cascade
);
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  club_id uuid not null,
  device_id uuid references public.push_devices(device_id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  token_snapshot text not null,
  state text not null default 'pending' check (state in ('pending','processing','sent','failed','skipped','unknown')),
  claimed_at timestamptz,
  ticket_id text,
  created_at timestamptz not null default now(),
  unique (event_id, device_id),
  foreign key (event_id,club_id) references public.push_events(id,club_id) on delete cascade
);
alter table public.push_events enable row level security;
alter table public.push_deliveries enable row level security;
revoke all on public.push_events, public.push_deliveries from public, anon, authenticated;
grant select on public.push_events, public.push_deliveries to service_role;

create function public.prepare_call_up_push(p_club_id uuid, p_call_up_id uuid, p_event_key text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_call public.call_ups; v_event public.push_events;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  select * into v_call from public.call_ups where club_id = p_club_id and id = p_call_up_id for update;
  if not found or v_call.status <> 'open' or v_call.local_date < (now() at time zone v_call.timezone)::date then
    raise exception 'Call-up unavailable' using errcode = '22023';
  end if;
  if p_event_key is null or char_length(p_event_key) not between 1 and 200 or p_kind is null or p_kind not in ('published','pending') then
    raise exception 'Invalid event' using errcode = '22023';
  end if;
  select * into v_event from public.push_events where club_id = p_club_id and event_key = p_event_key;
  if found then
    if v_event.call_up_id <> p_call_up_id or v_event.kind <> p_kind then raise exception 'Event key reused' using errcode = '22023'; end if;
    return v_event.id;
  end if;
  insert into public.push_events(club_id,call_up_id,event_key,kind) values (p_club_id,p_call_up_id,p_event_key,p_kind) returning * into v_event;
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot)
    select distinct v_event.id,p_club_id,d.device_id,d.user_id,d.expo_push_token
    from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=p_club_id and m.is_active
    join public.call_up_players p on p.user_id=d.user_id and p.call_up_id=p_call_up_id and p.club_id=p_club_id
    where d.is_active and d.expo_push_token is not null and (p_kind='published' or p.availability='unanswered');
  return v_event.id;
end;
$$;

create function public.claim_push_deliveries(p_event_id uuid, p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path = '' as $$
declare v_event public.push_events; v_call public.call_ups;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  select * into v_event from public.push_events where id=p_event_id for update;
  if not found then return; end if;
  select * into v_call from public.call_ups where id=v_event.call_up_id and club_id=v_event.club_id;
  update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
    v_call.status<>'open' or v_call.local_date<(now() at time zone v_call.timezone)::date
    or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
    or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
    or not exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.user_id=x.user_id and (v_event.kind='published' or p.availability='unanswered'))
  );
  return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
    update public.push_deliveries x set state='processing', claimed_at=now() from ready r where x.id=r.id returning x.*;
end;
$$;
revoke all on function public.prepare_call_up_push(uuid,uuid,text,text), public.claim_push_deliveries(uuid,integer) from public, anon, authenticated;
grant execute on function public.prepare_call_up_push(uuid,uuid,text,text), public.claim_push_deliveries(uuid,integer) to service_role;

commit;
