begin;

create function private.notification_recipient_allowed(p_club_id uuid,p_call_up_id uuid,p_user_id uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_kind in ('published','pending','reminder','vote','cancelled') and exists(
    select 1 from public.call_up_players p
    where p.club_id=p_club_id and p.call_up_id=p_call_up_id and p.user_id=p_user_id
    and (
      (p.category_snapshot<>'backups' and (p_kind not in ('pending','reminder') or p.availability='unanswered'))
      or (p.category_snapshot='backups' and p_kind='cancelled' and p.availability<>'unanswered')
    )
  );
$$;

create function private.filter_push_recipient() returns trigger language plpgsql security definer set search_path='' as $$
declare v_kind text;
begin
  select kind into v_kind from public.push_events where id=new.event_id and club_id=new.club_id;
  if not found then return new; end if;
  if not private.notification_recipient_allowed(new.club_id,
    (select call_up_id from public.push_events where id=new.event_id),new.user_id,v_kind) then return null; end if;
  return new;
end;
$$;
create trigger filter_push_recipient before insert on public.push_deliveries
for each row execute function private.filter_push_recipient();
revoke all on function private.notification_recipient_allowed(uuid,uuid,uuid,text), private.filter_push_recipient() from public,anon,authenticated;

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
