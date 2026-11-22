begin;

-- Device checks are private. Captains only receive a club-scoped aggregate.
create table private.push_device_checks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  state text not null check (state in ('enabled','disabled','denied','unregistered')),
  checked_at timestamptz not null default now(),
  primary key (user_id,device_id)
);
revoke all on private.push_device_checks from public,anon,authenticated;

create function public.report_push_device_status(p_device_id uuid,p_state text)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid := private.require_user();
begin
  if p_device_id is null or p_state is null or p_state not in ('enabled','disabled','denied','unregistered') then
    raise exception 'Invalid notification status' using errcode='22023';
  end if;
  if p_state='enabled' and not exists(select 1 from public.push_devices d where d.device_id=p_device_id and d.user_id=u and d.is_active and d.expo_push_token is not null) then
    raise exception 'Device is not registered' using errcode='22023';
  end if;
  insert into private.push_device_checks(user_id,device_id,state) values(u,p_device_id,p_state)
  on conflict(user_id,device_id) do update set state=excluded.state,checked_at=now();
end;
$$;

create function public.list_roster_notification_status(p_club_id uuid)
returns table(player_id uuid,status text,checked_at timestamptz,vote_notifications boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  return query
  select p.id,
    case
      when p.user_id is null then 'unlinked'
      when not exists(select 1 from public.club_members m where m.club_id=p_club_id and m.user_id=p.user_id and m.is_active) then 'no_membership'
      when exists(select 1 from public.push_devices d join private.push_device_checks c on c.device_id=d.device_id and c.user_id=d.user_id
        where d.user_id=p.user_id and d.is_active and d.expo_push_token is not null and c.state='enabled' and c.checked_at>now()-interval '7 days') then 'enabled'
      -- An old active device might still receive alerts. Do not claim all devices are blocked.
      when exists(select 1 from public.push_devices d where d.user_id=p.user_id and d.is_active and d.expo_push_token is not null) then 'unknown'
      when not exists(select 1 from private.push_device_checks c where c.user_id=p.user_id and c.checked_at>now()-interval '7 days') then 'unknown'
      when not exists(select 1 from private.push_device_checks c where c.user_id=p.user_id and c.checked_at>now()-interval '7 days' and c.state<>'disabled') then 'disabled'
      when exists(select 1 from private.push_device_checks c where c.user_id=p.user_id and c.checked_at>now()-interval '7 days' and c.state='denied') then 'denied'
      else 'no_device'
    end,
    (select max(c.checked_at) from private.push_device_checks c where c.user_id=p.user_id),
    coalesce(n.vote_notifications,true)
  from public.players p
  left join public.notification_preferences n on n.user_id=p.user_id
  where p.club_id=p_club_id and p.is_active;
end;
$$;
revoke all on function public.report_push_device_status(uuid,text),public.list_roster_notification_status(uuid) from public,anon,authenticated;
grant execute on function public.report_push_device_status(uuid,text),public.list_roster_notification_status(uuid) to authenticated;
commit;
