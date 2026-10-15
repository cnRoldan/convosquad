begin;

alter table public.clubs add column reminder_minutes integer
  check (reminder_minutes in (15,30,60,120,1440));
grant update (reminder_minutes) on public.clubs to authenticated;

create or replace function public.set_club_member(p_club_id uuid, p_user_id uuid, p_role public.club_role, p_is_active boolean)
returns public.club_members language plpgsql security definer set search_path = '' as $$
declare v_member public.club_members; v_owner uuid;
begin
  select created_by into v_owner from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  select * into v_member from public.club_members where club_id = p_club_id and user_id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = '22023'; end if;
  if p_user_id = v_owner and (p_role is distinct from 'admin' or p_is_active is distinct from true) then
    raise exception 'Club creator must remain captain' using errcode = '23514';
  end if;
  if p_role = 'admin' and p_is_active and (v_member.role <> 'admin' or not v_member.is_active)
    and (not v_member.is_active or not exists (select 1 from public.players where club_id=p_club_id and user_id=p_user_id and is_active)) then
    raise exception 'An active registered player is required' using errcode='23514';
  end if;
  if v_member.role='admin' and v_member.is_active and (p_role<>'admin' or not p_is_active)
    and (select count(*) from public.club_members where club_id=p_club_id and role='admin' and is_active)=1 then
    raise exception 'Cannot remove last captain' using errcode='23514';
  end if;
  update public.club_members set role=p_role, is_active=p_is_active where id=v_member.id returning * into v_member;
  return v_member;
end;
$$;

create function public.delete_club(p_club_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select created_by into v_owner from public.clubs where id=p_club_id for update;
  if not found or v_owner is distinct from private.require_user() then
    raise exception 'Only the creator can delete the club' using errcode='42501';
  end if;
  perform private.require_admin(p_club_id);
  delete from public.clubs where id=p_club_id;
end;
$$;
revoke all on function public.delete_club(uuid) from public, anon;
grant execute on function public.delete_club(uuid) to authenticated;

alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check (kind in ('published','pending','reminder'));
alter table public.push_events add column scheduled_start timestamptz;
alter table public.push_events add column reminder_minutes integer;

create or replace function public.prepare_call_up_push(p_club_id uuid, p_call_up_id uuid, p_event_key text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_call public.call_ups; v_event public.push_events; v_minutes integer;
begin
  select reminder_minutes into v_minutes from public.clubs where id=p_club_id for update;
  select * into v_call from public.call_ups where club_id=p_club_id and id=p_call_up_id for update;
  if not found or v_call.status<>'open' or v_call.local_date<(now() at time zone v_call.timezone)::date then
    raise exception 'Call-up unavailable' using errcode='22023';
  end if;
  if p_event_key is null or char_length(p_event_key) not between 1 and 200 or p_kind is null or p_kind not in ('published','pending','reminder') then
    raise exception 'Invalid event' using errcode='22023';
  end if;
  if p_kind='reminder' and (v_minutes is null or v_call.starts_at<=now() or v_call.starts_at-make_interval(mins=>v_minutes)>now()) then
    raise exception 'Reminder not due' using errcode='22023';
  end if;
  select * into v_event from public.push_events where club_id=p_club_id and event_key=p_event_key;
  if found then
    if v_event.call_up_id<>p_call_up_id or v_event.kind<>p_kind then raise exception 'Event key reused' using errcode='22023'; end if;
    return v_event.id;
  end if;
  insert into public.push_events(club_id,call_up_id,event_key,kind,scheduled_start,reminder_minutes)
    values (p_club_id,p_call_up_id,p_event_key,p_kind,
      case when p_kind='reminder' then v_call.starts_at end, case when p_kind='reminder' then v_minutes end) returning * into v_event;
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot)
    select distinct v_event.id,p_club_id,d.device_id,d.user_id,d.expo_push_token
    from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=p_club_id and m.is_active
    join public.call_up_players p on p.user_id=d.user_id and p.call_up_id=p_call_up_id and p.club_id=p_club_id
    where d.is_active and d.expo_push_token is not null and (p_kind<>'pending' or p.availability='unanswered');
  return v_event.id;
end;
$$;

create function public.prepare_due_call_up_reminders(p_limit integer default 100)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare v_row record; v_key text;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  for v_row in
    select c.id as club_id, u.id as call_up_id, u.starts_at, c.reminder_minutes
    from public.clubs c join public.call_ups u on u.club_id=c.id
    where c.reminder_minutes is not null and u.status='open' and u.starts_at>now()
      and u.starts_at-make_interval(mins=>c.reminder_minutes)<=now()
      and not exists (select 1 from public.push_events e where e.club_id=c.id and e.event_key=
        'reminder:'||u.id::text||':'||extract(epoch from u.starts_at)::text||':'||c.reminder_minutes::text)
    order by u.starts_at,c.id limit p_limit for update of c,u skip locked
  loop
    v_key:='reminder:'||v_row.call_up_id::text||':'||extract(epoch from v_row.starts_at)::text||':'||v_row.reminder_minutes::text;
    return next public.prepare_call_up_push(v_row.club_id,v_row.call_up_id,v_key,'reminder');
  end loop;
end;
$$;

create or replace function public.claim_push_deliveries(p_event_id uuid, p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path = '' as $$
declare v_event public.push_events; v_call public.call_ups;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  select * into v_event from public.push_events where id=p_event_id for update;
  if not found then return; end if;
  select * into v_call from public.call_ups where id=v_event.call_up_id and club_id=v_event.club_id;
  update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
    v_call.status<>'open' or v_call.local_date<(now() at time zone v_call.timezone)::date
    or (v_event.kind='reminder' and (v_call.starts_at<=now() or v_call.starts_at is distinct from v_event.scheduled_start
      or not exists (select 1 from public.clubs c where c.id=v_event.club_id and c.reminder_minutes=v_event.reminder_minutes)))
    or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
    or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
    or not exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.user_id=x.user_id and (v_event.kind<>'pending' or p.availability='unanswered'))
  );
  return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
    update public.push_deliveries x set state='processing',claimed_at=now() from ready r where x.id=r.id returning x.*;
end;
$$;

create function public.finish_push_delivery(p_delivery_id uuid, p_state text, p_ticket_id text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_state is null or p_state not in ('sent','failed','unknown') or char_length(p_ticket_id)>200 then
    raise exception 'Invalid delivery result' using errcode='22023';
  end if;
  update public.push_deliveries set state=p_state,ticket_id=p_ticket_id where id=p_delivery_id and state='processing';
end;
$$;
revoke all on function public.prepare_due_call_up_reminders(integer), public.finish_push_delivery(uuid,text,text) from public, anon, authenticated;
grant execute on function public.prepare_due_call_up_reminders(integer), public.finish_push_delivery(uuid,text,text) to service_role;

commit;
