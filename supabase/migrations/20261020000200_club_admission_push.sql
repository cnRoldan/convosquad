begin;
alter table public.push_events alter column call_up_id drop not null;
alter table public.push_events add column admission_request_id uuid references public.join_requests(id) on delete cascade,
 add column recipient_user_id uuid references public.profiles(id) on delete cascade,
 add column club_name_snapshot text;
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in ('published','pending','reminder','vote','cancelled','evaluation','club_approved'));
alter table public.push_events add constraint push_events_scope_check check(
 (kind='club_approved' and call_up_id is null and admission_request_id is not null and recipient_user_id is not null and club_name_snapshot is not null)
 or (kind<>'club_approved' and call_up_id is not null and admission_request_id is null and recipient_user_id is null));

create or replace function private.filter_push_recipient() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event public.push_events;
begin
 select * into v_event from public.push_events where id=new.event_id and club_id=new.club_id;
 if not found then return new; end if;
 if v_event.kind='club_approved' then
   if new.user_id is distinct from v_event.recipient_user_id or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=new.user_id and m.is_active) then return null; end if;
 elsif not private.notification_recipient_allowed(new.club_id,v_event.call_up_id,new.user_id,v_event.kind) then return null;
 end if;
 return new;
end;
$$;
create or replace function private.claim_call_up_push_deliveries(p_event_id uuid,p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path='' as $$
declare v_event public.push_events; v_call public.call_ups;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  select * into v_event from public.push_events where id=p_event_id for update;
  if not found then return; end if;
  select * into v_call from public.call_ups where id=v_event.call_up_id and club_id=v_event.club_id;
  update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
    not private.notification_recipient_allowed(v_event.club_id,v_event.call_up_id,x.user_id,v_event.kind)
    or (v_event.kind='cancelled' and (v_call.status<>'cancelled' or v_call.status_version is distinct from v_event.call_status_version))
    or (v_event.kind not in ('cancelled','evaluation') and (v_call.status<>'open' or v_call.closes_at<=clock_timestamp() or v_call.local_date<(now() at time zone v_call.timezone)::date))
    or (v_event.kind='evaluation' and (v_call.status not in ('open','closed') or v_call.evaluation_at is null or v_call.evaluation_at>clock_timestamp()
      or v_call.evaluation_at is distinct from v_event.evaluation_at or v_call.starts_at is distinct from v_event.scheduled_start
      or v_call.starts_at<clock_timestamp()-interval '3 months'
      or not exists(select 1 from public.call_up_players p where p.call_up_id=v_call.id and not exists(select 1 from public.player_ratings r where r.call_up_player_id=p.id))))
    or (v_event.kind='published' and v_event.call_status_version is not null and v_call.status_version<>v_event.call_status_version)
    or (v_event.kind='reminder' and (v_call.starts_at<=now() or v_call.starts_at is distinct from v_event.scheduled_start or v_call.last_notice_at is distinct from v_event.notice_at))
    or (v_event.kind='vote' and (x.user_id=v_event.actor_user_id or exists(select 1 from public.notification_preferences n where n.user_id=x.user_id and not n.vote_notifications)))
    or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
    or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
    or (v_event.kind not in ('published','cancelled','evaluation') and not exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.user_id=x.user_id and (v_event.kind not in ('pending','reminder') or p.availability='unanswered')))
  );
  if v_event.kind='published' then
    update public.push_deliveries x set can_vote=exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.club_id=v_event.club_id and p.user_id=x.user_id)
      where event_id=p_event_id and state='pending';
  end if;
  return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
    update public.push_deliveries x set state='processing',claimed_at=now() from ready r where x.id=r.id returning x.*;
end;
$$;


revoke all on function private.claim_call_up_push_deliveries(uuid,integer) from public,anon,authenticated,service_role;

create or replace function public.claim_push_deliveries(p_event_id uuid,p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path='' as $$
declare v_event public.push_events;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
 select * into v_event from public.push_events where id=p_event_id for update;
 if not found then return; end if;
 if v_event.kind<>'club_approved' then return query select * from private.claim_call_up_push_deliveries(p_event_id,p_limit); return; end if;
 update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
   x.user_id is distinct from v_event.recipient_user_id
   or not exists(select 1 from public.join_requests r where r.id=v_event.admission_request_id and r.club_id=v_event.club_id and r.user_id=x.user_id and r.status='approved')
   or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
   or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
 );
 return query with ready as(select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
 update public.push_deliveries x set state='processing',claimed_at=now(),can_vote=false from ready r where x.id=r.id returning x.*;
end;
$$;

create function private.notify_club_admission() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event uuid; v_name text;
begin
 if new.status<>'approved' or old.status<>'pending' then return new; end if;
 select name into v_name from public.clubs where id=new.club_id;
 insert into public.push_events(club_id,event_key,kind,admission_request_id,recipient_user_id,club_name_snapshot)
 values(new.club_id,'club-approved:'||new.id::text,'club_approved',new.id,new.user_id,v_name)
 on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is not null then
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
  select v_event,new.club_id,d.device_id,d.user_id,d.expo_push_token,false from public.push_devices d
  where d.user_id=new.user_id and d.is_active and d.expo_push_token is not null;
 end if;
 return new;
end;
$$;
create trigger notify_club_admission after update of status on public.join_requests for each row execute function private.notify_club_admission();
revoke all on function private.notify_club_admission() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
