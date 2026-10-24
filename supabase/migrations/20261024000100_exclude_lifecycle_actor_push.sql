begin;

-- Exclude the captain performing the lifecycle action on every registered device.
create or replace function private.enqueue_call_up_lifecycle_push() returns trigger language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups; v_event uuid; v_kind text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return null; end if;
  if new.status not in ('open','cancelled') then return null; end if;
  select * into v_call from public.call_ups where id=new.id for update;
  if not found or v_call.status_version<>new.status_version or v_call.status<>new.status
    or v_call.ends_at<=clock_timestamp() then return null; end if;
  v_kind:=case when v_call.status='open' then 'published' else 'cancelled' end;
  insert into public.push_events(club_id,call_up_id,event_key,kind,call_status_version,actor_user_id)
  values(v_call.club_id,v_call.id,v_kind||':'||v_call.id::text||':'||v_call.status_version::text,v_kind,v_call.status_version,auth.uid())
  on conflict(club_id,event_key) do nothing returning id into v_event;
  if v_event is null then return null; end if;
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
  select distinct v_event,v_call.club_id,d.device_id,d.user_id,d.expo_push_token,
    v_kind='published' and exists(select 1 from public.call_up_players p where p.call_up_id=v_call.id and p.club_id=v_call.club_id and p.user_id=d.user_id)
  from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=v_call.club_id and m.is_active
  where d.is_active and d.expo_push_token is not null and d.user_id is distinct from auth.uid();
  return null;
end;
$$;

commit;
