begin;

alter table public.call_ups add column status_version integer not null default 0;
alter table public.push_events add column call_status_version integer;
alter table public.push_deliveries add column can_vote boolean not null default true;
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in ('published','pending','reminder','vote','cancelled'));

create function private.version_call_up_status() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.status_version:=1;
  elsif new.status is distinct from old.status then new.status_version:=old.status_version+1;
  else new.status_version:=old.status_version;
  end if;
  return new;
end;
$$;
create trigger version_call_up_status before insert or update on public.call_ups
for each row execute function private.version_call_up_status();

create function private.enqueue_call_up_lifecycle_push() returns trigger language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups; v_event uuid; v_kind text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return null; end if;
  if new.status not in ('open','cancelled') then return null; end if;
  select * into v_call from public.call_ups where id=new.id for update;
  if not found or v_call.status_version<>new.status_version or v_call.status<>new.status
    or v_call.local_date<(now() at time zone v_call.timezone)::date then return null; end if;
  v_kind:=case when v_call.status='open' then 'published' else 'cancelled' end;
  insert into public.push_events(club_id,call_up_id,event_key,kind,call_status_version)
  values(v_call.club_id,v_call.id,v_kind||':'||v_call.id::text||':'||v_call.status_version::text,v_kind,v_call.status_version)
  on conflict(club_id,event_key) do nothing returning id into v_event;
  if v_event is null then return null; end if;
  insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
  select distinct v_event,v_call.club_id,d.device_id,d.user_id,d.expo_push_token,
    v_kind='published' and exists(select 1 from public.call_up_players p where p.call_up_id=v_call.id and p.club_id=v_call.club_id and p.user_id=d.user_id)
  from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=v_call.club_id and m.is_active
  where d.is_active and d.expo_push_token is not null;
  return null;
end;
$$;
-- Al final de la transacción ya existen la fotografía de jugadores y la configuración del aviso.
create constraint trigger enqueue_call_up_lifecycle_push after insert or update on public.call_ups
  deferrable initially deferred for each row execute function private.enqueue_call_up_lifecycle_push();
revoke all on function private.version_call_up_status(), private.enqueue_call_up_lifecycle_push() from public,anon,authenticated;

create or replace function public.claim_push_deliveries(p_event_id uuid,p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path='' as $$
declare v_event public.push_events; v_call public.call_ups;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  select * into v_event from public.push_events where id=p_event_id for update;
  if not found then return; end if;
  select * into v_call from public.call_ups where id=v_event.call_up_id and club_id=v_event.club_id;
  update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
    (v_event.kind='cancelled' and (v_call.status<>'cancelled' or v_call.status_version is distinct from v_event.call_status_version))
    or (v_event.kind<>'cancelled' and (v_call.status<>'open' or v_call.local_date<(now() at time zone v_call.timezone)::date))
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

commit;
