begin;

alter table public.call_ups add column closes_at timestamptz;
alter table public.call_ups add constraint call_ups_closing_valid check (
  closes_at is null or (closes_at<=starts_at and (closes_at at time zone timezone)::date=local_date
    and (last_notice_at is null or last_notice_at<closes_at))
);
create index call_ups_due_closing on public.call_ups(closes_at,club_id) where status='open' and closes_at is not null;

create function private.validate_call_up_closing() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.status='open' and new.closes_at<=clock_timestamp() then
    raise exception 'Voting deadline passed' using errcode='P0031';
  end if;
  return new;
end;
$$;
create trigger validate_call_up_closing before insert or update of status,closes_at on public.call_ups
for each row execute function private.validate_call_up_closing();
revoke all on function private.validate_call_up_closing() from public,anon,authenticated;

create function public.create_call_up_with_schedule(p_club_id uuid,p_starts_at timestamptz,
  p_last_notice_at timestamptz default null,p_status public.call_up_status default 'draft',p_closes_at timestamptz default null)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups;
begin
  select * into v_call from public.create_call_up_with_notice(p_club_id,p_starts_at,p_last_notice_at,p_status);
  update public.call_ups set closes_at=p_closes_at where id=v_call.id returning * into v_call;
  return v_call;
end;
$$;
create function public.update_call_up_with_schedule(p_call_up_id uuid,p_starts_at timestamptz,p_status public.call_up_status,
  p_last_notice_at timestamptz default null,p_closes_at timestamptz default null)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  update public.call_ups set closes_at=null,last_notice_at=null where id=p_call_up_id;
  select * into v_call from public.update_call_up_with_notice(p_call_up_id,p_starts_at,p_status,p_last_notice_at);
  update public.call_ups set closes_at=p_closes_at where id=p_call_up_id returning * into v_call;
  return v_call;
end;
$$;
revoke all on function public.create_call_up_with_schedule(uuid,timestamptz,timestamptz,public.call_up_status,timestamptz),
  public.update_call_up_with_schedule(uuid,timestamptz,public.call_up_status,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.create_call_up_with_schedule(uuid,timestamptz,timestamptz,public.call_up_status,timestamptz),
  public.update_call_up_with_schedule(uuid,timestamptz,public.call_up_status,timestamptz,timestamptz) to authenticated;

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
  if v_call.closes_at is not null and v_call.closes_at<=clock_timestamp() then
    raise exception 'Voting deadline passed' using errcode='P0031';
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
    or (v_event.kind<>'cancelled' and (v_call.status<>'open' or v_call.closes_at<=clock_timestamp() or v_call.local_date<(now() at time zone v_call.timezone)::date))
    or (v_event.kind='published' and v_event.call_status_version is not null and v_call.status_version<>v_event.call_status_version)
    or (v_event.kind='reminder' and (v_call.starts_at<=now() or v_call.starts_at is distinct from v_event.scheduled_start or v_call.last_notice_at is distinct from v_event.notice_at))
    or (v_event.kind='vote' and (x.user_id=v_event.actor_user_id or exists(select 1 from public.notification_preferences n where n.user_id=x.user_id and not n.vote_notifications)))
    or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
    or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
    or (v_event.kind not in ('published','cancelled') and not exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.user_id=x.user_id and (v_event.kind not in ('pending','reminder') or p.availability='unanswered')))
  );
  if v_event.kind='published' then
    update public.push_deliveries x set can_vote=exists(select 1 from public.call_up_players p where p.call_up_id=v_event.call_up_id and p.club_id=v_event.club_id and p.user_id=x.user_id)
      where event_id=p_event_id and state='pending';
  end if;
  return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
    update public.push_deliveries x set state='processing',claimed_at=now() from ready r where x.id=r.id returning x.*;
end;
$$;

create function private.close_due_call_ups() returns integer
language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_count integer; v_total integer:=0;
begin
  for v_club in select c.id from public.clubs c
    where exists(select 1 from public.call_ups u where u.club_id=c.id and u.status='open' and u.closes_at<=clock_timestamp())
    order by c.id for update of c skip locked
  loop
    update public.call_ups set status='closed' where club_id=v_club and status='open' and closes_at<=clock_timestamp();
    get diagnostics v_count=row_count;
    v_total:=v_total+v_count;
  end loop;
  return v_total;
end;
$$;
revoke all on function private.close_due_call_ups() from public,anon,authenticated;

do $$
begin
  if exists(select 1 from pg_catalog.pg_extension where extname='pg_cron') then
    execute $job$select cron.schedule('convosquad-close-call-ups','* * * * *','select private.close_due_call_ups()')$job$;
  end if;
end;
$$;
notify pgrst,'reload schema';
commit;
