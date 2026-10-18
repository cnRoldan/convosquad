begin;
alter table public.push_events add column evaluation_at timestamptz;
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in ('published','pending','reminder','vote','cancelled','evaluation'));

create or replace function private.notification_recipient_allowed(p_club_id uuid,p_call_up_id uuid,p_user_id uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when p_kind='evaluation' then exists(
    select 1 from public.club_members m join public.call_ups c on c.club_id=m.club_id
    where m.club_id=p_club_id and m.user_id=p_user_id and m.role='admin' and m.is_active and c.id=p_call_up_id
      and c.status in ('open','closed') and c.evaluation_at<=now() and c.starts_at>=now()-interval '3 months'
  ) else p_kind in ('published','pending','reminder','vote','cancelled') and exists(
    select 1 from public.call_up_players p
    where p.club_id=p_club_id and p.call_up_id=p_call_up_id and p.user_id=p_user_id
    and (
      (p.category_snapshot<>'backups' and (p_kind not in ('pending','reminder') or p.availability='unanswered')
        and (p_kind<>'published' or not exists(select 1 from public.club_decision_locks l where l.club_id=p_club_id and l.user_id=p_user_id)))
      or (p.category_snapshot='backups' and p_kind='cancelled' and p.availability<>'unanswered')
    )
  ) end;
$$;

create or replace function public.claim_push_deliveries(p_event_id uuid,p_limit integer default 100)
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

create or replace function public.prepare_due_call_up_reminders(p_limit integer default 100)
returns setof uuid language plpgsql security definer set search_path='' as $$
declare v_row record; v_key text; v_event uuid; v_count integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  for v_row in select u.* from public.call_ups u join public.clubs c on c.id=u.club_id
    where u.last_notice_at is not null and u.status='open' and u.starts_at>now() and u.last_notice_at<=now()
    and not exists(select 1 from public.push_events e where e.club_id=u.club_id and e.event_key='last-notice:'||u.id::text||':'||extract(epoch from u.last_notice_at)::text)
    order by u.last_notice_at,u.id limit p_limit for update of c,u skip locked
  loop
    v_key:='last-notice:'||v_row.id::text||':'||extract(epoch from v_row.last_notice_at)::text;
    return next public.prepare_call_up_push(v_row.club_id,v_row.id,v_key,'reminder');
    v_count:=v_count+1;
  end loop;
  for v_row in select u.* from public.call_ups u join public.clubs c on c.id=u.club_id
    where u.status in ('open','closed') and u.evaluation_at<=now() and u.starts_at>=now()-interval '3 months'
      and exists(select 1 from public.call_up_players p where p.call_up_id=u.id and not exists(select 1 from public.player_ratings r where r.call_up_player_id=p.id))
      and not exists(select 1 from public.push_events e where e.club_id=u.club_id and e.event_key=
        'evaluation:'||u.id::text||':'||extract(epoch from u.evaluation_at)::text||':'||extract(epoch from u.starts_at)::text)
    order by u.evaluation_at,u.id limit (p_limit-v_count) for update of c,u skip locked
  loop
    v_key:='evaluation:'||v_row.id::text||':'||extract(epoch from v_row.evaluation_at)::text||':'||extract(epoch from v_row.starts_at)::text;
    insert into public.push_events(club_id,call_up_id,event_key,kind,evaluation_at,scheduled_start)
      values(v_row.club_id,v_row.id,v_key,'evaluation',v_row.evaluation_at,v_row.starts_at)
      on conflict(club_id,event_key) do nothing returning id into v_event;
    if v_event is not null then
      insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
        select v_event,v_row.club_id,d.device_id,d.user_id,d.expo_push_token,false
        from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=v_row.club_id and m.is_active and m.role='admin'
        where d.is_active and d.expo_push_token is not null;
      return next v_event;
    end if;
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
