begin;
create table public.club_decision_locks (
  club_id uuid not null,
  user_id uuid not null,
  availability public.availability_status not null check(availability in ('available','unavailable','backup')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(club_id,user_id),
  foreign key(club_id,user_id) references public.club_members(club_id,user_id) on delete cascade
);
alter table public.club_decision_locks enable row level security;
revoke all on public.club_decision_locks from public,anon,authenticated;
grant select on public.club_decision_locks to authenticated;
create policy own_decision_lock on public.club_decision_locks for select to authenticated
  using(user_id=auth.uid() and private.is_member(club_id));
alter table public.call_up_players add column auto_response boolean not null default false;

create function public.set_club_decision_lock(p_club_id uuid,p_enabled boolean,p_call_up_player_id uuid default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_entry public.call_up_players; v_call public.call_ups;
begin
  perform 1 from public.clubs where id=p_club_id for update;
  if not private.is_member(p_club_id) then raise exception 'Not a member' using errcode='42501'; end if;
  if p_enabled is null then raise exception 'Choose lock state' using errcode='22023'; end if;
  if not p_enabled then
    delete from public.club_decision_locks where club_id=p_club_id and user_id=v_user;
    return false;
  end if;
  select * into v_entry from public.call_up_players where id=p_call_up_player_id and club_id=p_club_id and user_id=v_user for update;
  if not found or not exists(select 1 from public.players p where p.id=v_entry.source_player_id and p.club_id=p_club_id and p.user_id=v_user and p.is_active) then
    raise exception 'No own active player' using errcode='42501';
  end if;
  select * into v_call from public.call_ups where id=v_entry.call_up_id and club_id=p_club_id;
  if v_call.status='cancelled' or v_call.local_date<(now() at time zone v_call.timezone)::date or v_entry.availability='unanswered' then
    raise exception 'Vote before keeping your decision' using errcode='22023';
  end if;
  insert into public.club_decision_locks(club_id,user_id,availability) values(p_club_id,v_user,v_entry.availability)
  on conflict(club_id,user_id) do update set availability=excluded.availability,updated_at=clock_timestamp();
  return true;
end;
$$;
revoke all on function public.set_club_decision_lock(uuid,boolean,uuid) from public,anon,authenticated;
grant execute on function public.set_club_decision_lock(uuid,boolean,uuid) to authenticated;

create function private.apply_retained_decision() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_lock public.club_decision_locks; v_call public.call_ups;
begin
  if tg_op='UPDATE' and new.responded_at is distinct from old.responded_at then new.auto_response:=false; end if;
  if new.availability<>'unanswered' then return new; end if;
  new.auto_response:=false;
  select * into v_lock from public.club_decision_locks where club_id=new.club_id and user_id=new.user_id;
  if not found or not exists(select 1 from public.club_members m where m.club_id=new.club_id and m.user_id=new.user_id and m.is_active)
    or not exists(select 1 from public.players p where p.id=new.source_player_id and p.club_id=new.club_id and p.user_id=new.user_id and p.is_active) then return new; end if;
  select * into v_call from public.call_ups where id=new.call_up_id and club_id=new.club_id;
  if v_call.local_date<(now() at time zone v_call.timezone)::date or v_call.starts_at<v_lock.created_at then return new; end if;
  new.availability:=v_lock.availability;
  new.responded_at:=clock_timestamp();
  new.auto_response:=true;
  return new;
end;
$$;
create trigger apply_retained_decision before insert or update of availability,user_id,responded_at on public.call_up_players
  for each row execute function private.apply_retained_decision();

create function private.sync_retained_decision() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.auto_response and new.user_id=auth.uid() and new.availability<>'unanswered'
    and new.responded_at is distinct from old.responded_at and private.is_member(new.club_id) then
    update public.club_decision_locks set availability=new.availability,updated_at=clock_timestamp()
      where club_id=new.club_id and user_id=new.user_id;
  end if;
  return null;
end;
$$;
create trigger sync_retained_decision after update of availability,responded_at on public.call_up_players
  for each row execute function private.sync_retained_decision();

create function private.apply_retained_decisions_on_open() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='open' and old.status is distinct from new.status then
    -- Updating unanswered rows runs the snapshot trigger; existing votes survive.
    update public.call_up_players set availability='unanswered'
      where club_id=new.club_id and call_up_id=new.id and availability='unanswered';
  end if;
  return new;
end;
$$;
create trigger apply_retained_decisions_on_open before update of status on public.call_ups
  for each row execute function private.apply_retained_decisions_on_open();

create function private.clear_departed_decision_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='club_members' then
    if not new.is_active then delete from public.club_decision_locks where club_id=new.club_id and user_id=new.user_id; end if;
  elsif old.user_id is not null and (new.user_id is distinct from old.user_id or not new.is_active) then
    delete from public.club_decision_locks where club_id=old.club_id and user_id=old.user_id;
  end if;
  return null;
end;
$$;
create trigger clear_departed_decision_lock after update of is_active on public.club_members
  for each row execute function private.clear_departed_decision_lock();
create trigger clear_unlinked_decision_lock after update of user_id,is_active on public.players
  for each row execute function private.clear_departed_decision_lock();
revoke all on function private.apply_retained_decision(),private.sync_retained_decision(),
  private.apply_retained_decisions_on_open(),private.clear_departed_decision_lock() from public,anon,authenticated;

create or replace function private.notification_recipient_allowed(p_club_id uuid,p_call_up_id uuid,p_user_id uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_kind in ('published','pending','reminder','vote','cancelled') and exists(
    select 1 from public.call_up_players p
    where p.club_id=p_club_id and p.call_up_id=p_call_up_id and p.user_id=p_user_id
    and (
      (p.category_snapshot<>'backups' and (p_kind not in ('pending','reminder') or p.availability='unanswered')
        and (p_kind<>'published' or not exists(select 1 from public.club_decision_locks l where l.club_id=p_club_id and l.user_id=p_user_id)))
      or (p.category_snapshot='backups' and p_kind='cancelled' and p.availability<>'unanswered')
    )
  );
$$;

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
  if not v_entry.auto_response and v_entry.responded_at is not null and v_entry.responded_at>clock_timestamp()-interval '30 seconds' then
    raise exception 'Wait before changing availability' using errcode='P0030';
  end if;
  update public.call_up_players set availability=p_availability,auto_response=false,responded_at=clock_timestamp(),updated_at=clock_timestamp(),availability_version=availability_version+1
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

notify pgrst,'reload schema';
commit;
