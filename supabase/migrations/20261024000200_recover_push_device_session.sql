begin;

create or replace function public.register_push_device(p_device_id uuid, p_expo_push_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_owner uuid; v_token text;
begin
  if p_device_id is null or p_platform is null or p_platform not in ('android', 'ios') or p_expo_push_token is null
    or char_length(p_expo_push_token) > 300 or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid device' using errcode = '22023';
  end if;
  -- Serializa el alta de IDs nuevos y la rotación/reutilización del mismo token.
  perform pg_advisory_xact_lock(hashtextextended(p_device_id::text, 5));
  perform pg_advisory_xact_lock(hashtextextended(p_expo_push_token, 6));
  select user_id,expo_push_token into v_owner,v_token from public.push_devices where device_id = p_device_id for update;
  if v_owner is not null and v_owner <> v_user and v_token is distinct from p_expo_push_token then raise exception 'Device belongs to another user' using errcode = '42501'; end if;
  if exists (select 1 from public.push_devices where expo_push_token = p_expo_push_token and device_id <> p_device_id and user_id is distinct from v_user) then
    raise exception 'Token belongs to another user' using errcode = '42501';
  end if;
  -- Possession of both installation ID and its existing token permits account switching.
  -- Neither identifier alone can claim another installation.
  if v_owner is distinct from v_user then
    update public.push_deliveries set state='skipped'
      where device_id=p_device_id and state='pending';
  end if;
  update public.push_devices set is_active = false, expo_push_token = null, updated_at = now()
    where expo_push_token = p_expo_push_token and device_id <> p_device_id and user_id = v_user;
  insert into public.push_devices(device_id, user_id, expo_push_token, platform, is_active)
    values (p_device_id, v_user, p_expo_push_token, p_platform, true)
  on conflict (device_id) do update set user_id = v_user, expo_push_token = p_expo_push_token,
    platform = p_platform, is_active = true, updated_at = now();
end;
$$;

commit;
