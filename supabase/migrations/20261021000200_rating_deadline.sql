begin;

create index call_ups_latest_finished on public.call_ups(club_id,ends_at desc,starts_at desc,id desc)
  where status in ('open','closed');

-- Keep performance history; this ledger only records whether a captain saved a rating.
create table private.rating_submissions (
  call_up_id uuid not null references public.call_ups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  saved_at timestamptz not null default clock_timestamp(),
  primary key(call_up_id,user_id)
);
revoke all on private.rating_submissions from public,anon,authenticated,service_role;
insert into private.rating_submissions(call_up_id,user_id,saved_at)
select call_up_id,rated_by,max(updated_at) from public.player_ratings where rated_by is not null group by call_up_id,rated_by;

create function private.can_rate_call_up(p_call_up_id uuid,p_at timestamptz default now()) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.call_ups c where c.id=p_call_up_id
    and c.status in ('open','closed') and c.evaluation_at<=p_at and c.ends_at<=p_at
    and p_at<c.ends_at+interval '24 hours'
    and c.id=(select latest.id from public.call_ups latest where latest.club_id=c.club_id
      and latest.status in ('open','closed') and latest.ends_at<=p_at
      order by latest.ends_at desc,latest.starts_at desc,latest.id desc limit 1));
$$;
revoke all on function private.can_rate_call_up(uuid,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.list_rating_call_ups(p_club_id uuid) returns setof public.call_ups
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  return query select c.* from public.call_ups c where c.club_id=p_club_id
    and c.ends_at>now()-interval '24 hours' and c.ends_at<=now() and private.can_rate_call_up(c.id)
    order by c.ends_at desc,c.starts_at desc,c.id desc limit 1;
end;
$$;

create or replace function public.save_player_ratings(p_call_up_id uuid,p_ratings jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_club uuid; v_call public.call_ups; v_entry public.call_up_players;
  v_item jsonb; v_id uuid; v_ids uuid[]:='{}'; v_current public.player_ratings; v_expected timestamptz;
  v_score smallint; v_not_selected boolean; v_clear boolean; v_count integer:=0;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club for update;
  if not found or not private.can_rate_call_up(p_call_up_id,clock_timestamp()) then
    raise exception 'Only the latest finished call-up can be rated, within 24 hours' using errcode='P0041';
  end if;
  if p_ratings is null or jsonb_typeof(p_ratings)<>'array' then raise exception 'Invalid ratings' using errcode='22023'; end if;
  if jsonb_array_length(p_ratings) not between 1 and 200 then raise exception 'Invalid ratings count' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_ratings) loop
    if jsonb_typeof(v_item)<>'object' or not (v_item ? 'expected_updated_at')
      or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('entry_id','score','not_selected','clear','expected_updated_at')) then
      raise exception 'Invalid rating entry' using errcode='22023';
    end if;
    v_id:=(v_item->>'entry_id')::uuid;
    if v_id is null or v_id=any(v_ids) then raise exception 'Duplicate or missing entry' using errcode='22023'; end if;
    v_ids:=array_append(v_ids,v_id);
    select * into v_entry from public.call_up_players where id=v_id and call_up_id=v_call.id and club_id=v_club;
    if not found then raise exception 'Player is not in this call-up' using errcode='42501'; end if;
    v_current:=null;
    select * into v_current from public.player_ratings where call_up_player_id=v_id for update;
    v_expected:=(v_item->>'expected_updated_at')::timestamptz;
    if v_current.updated_at is distinct from v_expected then raise exception 'Ratings changed; reload before saving' using errcode='40001'; end if;
    v_clear:=coalesce((v_item->>'clear')::boolean,false);
    v_not_selected:=coalesce((v_item->>'not_selected')::boolean,false);
    if v_item->>'score' is not null and (v_item->>'score') !~ '^(10|[0-9])$' then raise exception 'Score must be 0 to 10' using errcode='22023'; end if;
    v_score:=(v_item->>'score')::smallint;
    if v_clear then
      if v_score is not null or v_not_selected then raise exception 'Ambiguous rating' using errcode='22023'; end if;
      delete from public.player_ratings where call_up_player_id=v_id;
    else
      if (v_score is null and not v_not_selected) or (v_score is not null and v_not_selected) then raise exception 'Choose a score or not selected' using errcode='22023'; end if;
      insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score,not_selected,rated_by)
      values(v_id,v_club,v_call.id,coalesce(v_entry.source_player_id,v_entry.id),v_entry.ea_id_snapshot,v_score,v_not_selected,v_user)
      on conflict(call_up_player_id) do update set score=excluded.score,not_selected=excluded.not_selected,rated_by=v_user,
        player_name=excluded.player_name,updated_at=clock_timestamp();
    end if;
    v_count:=v_count+1;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_ratings) item where not coalesce((item->>'clear')::boolean,false)) then
    insert into private.rating_submissions(call_up_id,user_id) values(v_call.id,v_user)
    on conflict(call_up_id,user_id) do update set saved_at=excluded.saved_at;
  end if;
  return v_count;
end;
$$;

create or replace function private.notification_recipient_allowed(p_club_id uuid,p_call_up_id uuid,p_user_id uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
  select case when p_kind in ('evaluation','evaluation_deadline') then exists(
    select 1 from public.club_members m join public.call_ups c on c.club_id=m.club_id
    where m.club_id=p_club_id and m.user_id=p_user_id and m.role='admin' and m.is_active and c.id=p_call_up_id
      and private.can_rate_call_up(c.id)
      and (p_kind<>'evaluation_deadline' or c.ends_at+interval '19 hours'<=now())
      and (p_kind<>'evaluation' or now()<c.ends_at+interval '19 hours')
      and not exists(select 1 from private.rating_submissions s where s.call_up_id=c.id and s.user_id=p_user_id)
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
    or (v_event.kind not in ('cancelled','evaluation','evaluation_deadline') and (v_call.status<>'open' or v_call.closes_at<=clock_timestamp() or v_call.ends_at<=clock_timestamp()))
    or (v_event.kind in ('evaluation','evaluation_deadline') and (
      not private.can_rate_call_up(v_call.id,clock_timestamp())
      or v_call.evaluation_at is distinct from v_event.evaluation_at
      or v_call.starts_at is distinct from v_event.scheduled_start))
    or (v_event.kind='published' and v_event.call_status_version is not null and v_call.status_version<>v_event.call_status_version)
    or (v_event.kind='reminder' and (v_call.starts_at<=now() or v_call.starts_at is distinct from v_event.scheduled_start or v_call.last_notice_at is distinct from v_event.notice_at))
    or (v_event.kind='vote' and (x.user_id=v_event.actor_user_id or exists(select 1 from public.notification_preferences n where n.user_id=x.user_id and not n.vote_notifications)))
    or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
    or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
    or (v_event.kind not in ('published','cancelled','evaluation','evaluation_deadline') and not exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.user_id=x.user_id and (v_event.kind not in ('pending','reminder') or p.availability='unanswered')))
  );
  if v_event.kind='published' then
    update public.push_deliveries x set can_vote=exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.club_id=v_event.club_id and p.user_id=x.user_id)
      where event_id=p_event_id and state='pending';
  end if;
  return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
    update public.push_deliveries x set state='processing',claimed_at=now() from ready r where x.id=r.id returning x.*;
end;
$$;


alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in
  ('published','pending','reminder','vote','cancelled','evaluation','evaluation_deadline','club_approved','club_join_request'));

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
  for v_row in select u.*,phase.kind from public.call_ups u join public.clubs c on c.id=u.club_id
    cross join (values ('evaluation',interval '0 hours',interval '19 hours'),
      ('evaluation_deadline',interval '19 hours',interval '24 hours')) phase(kind,opens,closes)
    where u.ends_at>now()-interval '24 hours' and u.ends_at<=now() and private.can_rate_call_up(u.id)
      and u.ends_at+phase.opens<=now() and now()<u.ends_at+phase.closes
      and exists(select 1 from public.call_up_players p where p.call_up_id=u.id)
      and exists(select 1 from public.club_members m where m.club_id=u.club_id and m.role='admin' and m.is_active
        and not exists(select 1 from private.rating_submissions s where s.call_up_id=u.id and s.user_id=m.user_id))
      and not exists(select 1 from public.push_events e where e.club_id=u.club_id and e.event_key=
        phase.kind||':'||u.id::text||':'||extract(epoch from u.evaluation_at)::text||':'||extract(epoch from u.starts_at)::text)
    order by u.ends_at,u.id limit (p_limit-v_count) for update of c,u skip locked
  loop
    v_key:=v_row.kind||':'||v_row.id::text||':'||extract(epoch from v_row.evaluation_at)::text||':'||extract(epoch from v_row.starts_at)::text;
    v_event:=null;
    insert into public.push_events(club_id,call_up_id,event_key,kind,evaluation_at,scheduled_start)
      values(v_row.club_id,v_row.id,v_key,v_row.kind,v_row.evaluation_at,v_row.starts_at)
      on conflict(club_id,event_key) do nothing returning id into v_event;
    if v_event is not null then
      insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
        select v_event,v_row.club_id,d.device_id,d.user_id,d.expo_push_token,false
        from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=v_row.club_id and m.is_active and m.role='admin'
        where d.is_active and d.expo_push_token is not null
          and private.notification_recipient_allowed(v_row.club_id,v_row.id,d.user_id,v_row.kind);
      return next v_event;
    end if;
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
