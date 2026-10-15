begin;

alter table public.call_ups add column last_notice_at timestamptz;
-- Conserva la configuración de las convocatorias futuras que ya tenían avisos.
update public.call_ups u set last_notice_at=u.starts_at-make_interval(mins=>c.reminder_minutes)
from public.clubs c where c.id=u.club_id and c.reminder_minutes is not null and u.starts_at>now()
  and ((u.starts_at-make_interval(mins=>c.reminder_minutes)) at time zone u.timezone)::date=u.local_date;
alter table public.call_ups add constraint call_ups_last_notice_valid check (
  last_notice_at is null or (last_notice_at<starts_at and (last_notice_at at time zone timezone)::date=local_date)
);
alter table public.call_up_players add column availability_version integer not null default 0;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vote_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant select on public.notification_preferences to authenticated;
create policy notification_preferences_read_own on public.notification_preferences for select to authenticated
using (user_id=(select auth.uid()));

create function public.set_notification_preferences(p_vote_notifications boolean)
returns public.notification_preferences language plpgsql security definer set search_path='' as $$
declare v_result public.notification_preferences;
begin
  if p_vote_notifications is null then raise exception 'Invalid preference' using errcode='22023'; end if;
  insert into public.notification_preferences(user_id,vote_notifications) values(private.require_user(),p_vote_notifications)
  on conflict(user_id) do update set vote_notifications=excluded.vote_notifications,updated_at=now() returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.set_notification_preferences(boolean) from public,anon;
grant execute on function public.set_notification_preferences(boolean) to authenticated;

create function public.create_call_up_with_notice(p_club_id uuid,p_starts_at timestamptz,p_last_notice_at timestamptz default null,p_status public.call_up_status default 'draft')
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups;
begin
  select * into v_call from public.create_call_up(p_club_id,p_starts_at,p_status);
  update public.call_ups set last_notice_at=p_last_notice_at where id=v_call.id returning * into v_call;
  return v_call;
end;
$$;
create function public.update_call_up_with_notice(p_call_up_id uuid,p_starts_at timestamptz,p_status public.call_up_status,p_last_notice_at timestamptz default null)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups; v_club uuid;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  update public.call_ups set last_notice_at=null where id=p_call_up_id;
  select * into v_call from public.update_call_up(p_call_up_id,p_starts_at,p_status);
  update public.call_ups set last_notice_at=p_last_notice_at where id=p_call_up_id returning * into v_call;
  return v_call;
end;
$$;
revoke all on function public.create_call_up_with_notice(uuid,timestamptz,timestamptz,public.call_up_status), public.update_call_up_with_notice(uuid,timestamptz,public.call_up_status,timestamptz) from public,anon;
grant execute on function public.create_call_up_with_notice(uuid,timestamptz,timestamptz,public.call_up_status), public.update_call_up_with_notice(uuid,timestamptz,public.call_up_status,timestamptz) to authenticated;

alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in ('published','pending','reminder','vote'));
alter table public.push_events add column notice_at timestamptz,
  add column actor_user_id uuid references public.profiles(id) on delete set null,
  add column actor_ea_id text,
  add column vote_availability public.availability_status;

create or replace function public.respond_to_call_up(p_call_up_player_id uuid,p_availability public.availability_status)
returns public.call_up_players language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_entry public.call_up_players; v_call public.call_ups; v_club uuid; v_event uuid;
begin
  select club_id into v_club from public.call_up_players where id=p_call_up_player_id;
  perform 1 from public.clubs where id=v_club for update;
  select c.* into v_call from public.call_ups c join public.call_up_players s on s.call_up_id=c.id where s.id=p_call_up_player_id for update of c;
  select * into v_entry from public.call_up_players where id=p_call_up_player_id for update;
  if not found or v_entry.user_id is distinct from v_user or not private.is_member(v_entry.club_id)
    or v_call.status<>'open' or v_call.local_date<(now() at time zone v_call.timezone)::date then
    raise exception 'Not authorized to respond' using errcode='42501';
  end if;
  if p_availability is null or p_availability not in ('available','unavailable','backup') then
    raise exception 'Choose a response' using errcode='22023';
  end if;
  if v_entry.availability=p_availability then return v_entry; end if;
  if v_entry.responded_at is not null and v_entry.responded_at>clock_timestamp()-interval '30 seconds' then
    raise exception 'Wait before changing availability' using errcode='P0030';
  end if;
  update public.call_up_players set availability=p_availability,responded_at=clock_timestamp(),updated_at=clock_timestamp(),availability_version=availability_version+1
  where id=v_entry.id returning * into v_entry;
  insert into public.push_events(club_id,call_up_id,event_key,kind,actor_user_id,actor_ea_id,vote_availability)
  values(v_club,v_call.id,'vote:'||v_entry.id::text||':'||v_entry.availability_version::text,'vote',v_user,v_entry.ea_id_snapshot,p_availability)
  returning id into v_event;
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot)
  select distinct v_event,v_club,d.device_id,d.user_id,d.expo_push_token from public.push_devices d
  join public.club_members m on m.user_id=d.user_id and m.club_id=v_club and m.is_active
  join public.call_up_players p on p.user_id=d.user_id and p.call_up_id=v_call.id and p.club_id=v_club
  left join public.notification_preferences n on n.user_id=d.user_id
  where d.is_active and d.expo_push_token is not null and d.user_id<>v_user and coalesce(n.vote_notifications,true);
  return v_entry;
end;
$$;

create table private.push_response_actions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_id text not null check(char_length(action_id) between 1 and 200),
  call_up_id uuid not null references public.call_ups(id) on delete cascade,
  availability public.availability_status not null,
  created_at timestamptz not null default now(),
  primary key(user_id,action_id)
);
alter table private.push_response_actions enable row level security;
revoke all on private.push_response_actions from public,anon,authenticated;

create function public.respond_from_notification(p_club_id uuid,p_call_up_id uuid,p_availability public.availability_status,p_action_id text)
returns public.call_up_players language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_entry public.call_up_players; v_action private.push_response_actions;
begin
  if p_action_id is null or char_length(p_action_id) not between 1 and 200 then raise exception 'Invalid action' using errcode='22023'; end if;
  perform 1 from public.clubs where id=p_club_id for update;
  if not private.is_member(p_club_id) then raise exception 'Not a member' using errcode='42501'; end if;
  select * into v_entry from public.call_up_players where call_up_id=p_call_up_id and club_id=p_club_id and user_id=v_user;
  if not found then raise exception 'No linked player' using errcode='42501'; end if;
  select * into v_action from private.push_response_actions where user_id=v_user and action_id=p_action_id;
  if found then
    if v_action.call_up_id<>p_call_up_id or v_action.availability<>p_availability then raise exception 'Action key reused' using errcode='22023'; end if;
    return v_entry;
  end if;
  select * into v_entry from public.respond_to_call_up(v_entry.id,p_availability);
  insert into private.push_response_actions(user_id,action_id,call_up_id,availability) values(v_user,p_action_id,p_call_up_id,p_availability);
  return v_entry;
end;
$$;
revoke all on function public.respond_from_notification(uuid,uuid,public.availability_status,text) from public,anon;
grant execute on function public.respond_from_notification(uuid,uuid,public.availability_status,text) to authenticated;

create or replace function public.prepare_call_up_push(p_club_id uuid, p_call_up_id uuid, p_event_key text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_call public.call_ups; v_event public.push_events; 
begin
  perform 1 from public.clubs where id=p_club_id for update;
  select * into v_call from public.call_ups where club_id=p_club_id and id=p_call_up_id for update;
  if not found or v_call.status<>'open' or v_call.local_date<(now() at time zone v_call.timezone)::date then
    raise exception 'Call-up unavailable' using errcode='22023';
  end if;
  if p_event_key is null or char_length(p_event_key) not between 1 and 200 or p_kind is null or p_kind not in ('published','pending','reminder') then
    raise exception 'Invalid event' using errcode='22023';
  end if;
  if p_kind='reminder' and (v_call.last_notice_at is null or v_call.starts_at<=now() or v_call.last_notice_at>now()) then
    raise exception 'Reminder not due' using errcode='22023';
  end if;
  select * into v_event from public.push_events where club_id=p_club_id and event_key=p_event_key;
  if found then
    if v_event.call_up_id<>p_call_up_id or v_event.kind<>p_kind then raise exception 'Event key reused' using errcode='22023'; end if;
    return v_event.id;
  end if;
  insert into public.push_events(club_id,call_up_id,event_key,kind,scheduled_start,notice_at)
    values (p_club_id,p_call_up_id,p_event_key,p_kind,
      case when p_kind='reminder' then v_call.starts_at end, case when p_kind='reminder' then v_call.last_notice_at end) returning * into v_event;
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot)
    select distinct v_event.id,p_club_id,d.device_id,d.user_id,d.expo_push_token
    from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=p_club_id and m.is_active
    join public.call_up_players p on p.user_id=d.user_id and p.call_up_id=p_call_up_id and p.club_id=p_club_id
    where d.is_active and d.expo_push_token is not null and (p_kind='published' or p.availability='unanswered');
  return v_event.id;
end;
$$;

create or replace function public.prepare_due_call_up_reminders(p_limit integer default 100)
returns setof uuid language plpgsql security definer set search_path='' as $$
declare v_row record; v_key text;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  for v_row in select u.* from public.call_ups u join public.clubs c on c.id=u.club_id
    where u.last_notice_at is not null and u.status='open' and u.starts_at>now() and u.last_notice_at<=now()
    and not exists(select 1 from public.push_events e where e.club_id=u.club_id and e.event_key='last-notice:'||u.id::text||':'||extract(epoch from u.last_notice_at)::text)
    order by u.last_notice_at,u.id limit p_limit for update of c,u skip locked
  loop
    v_key:='last-notice:'||v_row.id::text||':'||extract(epoch from v_row.last_notice_at)::text;
    return next public.prepare_call_up_push(v_row.club_id,v_row.id,v_key,'reminder');
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
      or v_call.last_notice_at is distinct from v_event.notice_at))
    or (v_event.kind='vote' and (x.user_id=v_event.actor_user_id or exists(select 1 from public.notification_preferences n where n.user_id=x.user_id and not n.vote_notifications)))
    or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
    or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
    or not exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.user_id=x.user_id and (v_event.kind not in ('pending','reminder') or p.availability='unanswered'))
  );
  return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
    update public.push_deliveries x set state='processing',claimed_at=now() from ready r where x.id=r.id returning x.*;
end;
$$;

commit;
