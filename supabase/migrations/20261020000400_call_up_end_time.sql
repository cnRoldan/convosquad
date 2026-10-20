begin;

-- Existing scheduled ratings retain their opening time. Calls without ratings end
-- at the following local midnight. New clients always send an explicit end time.
alter table public.call_ups add column ends_at timestamptz;
update public.call_ups set ends_at=coalesce(evaluation_at, (local_date+1)::timestamp at time zone timezone);
-- Flush deferred constraint triggers from populated databases before further DDL.
set constraints all immediate;
alter table public.call_ups alter column ends_at set not null;
alter table public.call_ups add constraint call_up_end_after_start check(ends_at>=starts_at);
alter table public.call_ups add constraint call_up_rating_at_end check(evaluation_at is null or evaluation_at=ends_at);
create index call_ups_club_end on public.call_ups(club_id,ends_at);

-- Also supports older builds: their optional evaluation time becomes the end.
-- Start-only edits receive a fresh default end; no stale end can precede a start.
create or replace function private.stamp_call_up() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    select c.timezone into new.timezone from public.clubs c where c.id=new.club_id;
    new.created_by:=auth.uid();
  end if;
  new.local_date:=(new.starts_at at time zone new.timezone)::date;
  if tg_op='INSERT' then
    new.ends_at:=coalesce(new.ends_at,new.evaluation_at,(new.local_date+1)::timestamp at time zone new.timezone);
  else
    if new.starts_at is distinct from old.starts_at and new.ends_at is not distinct from old.ends_at then
      new.ends_at:=(new.local_date+1)::timestamp at time zone new.timezone;
    end if;
    if new.evaluation_at is not null and new.evaluation_at is distinct from old.evaluation_at
      and new.ends_at is not distinct from old.ends_at then
      new.ends_at:=new.evaluation_at;
    end if;
    if new.ends_at is distinct from old.ends_at and new.evaluation_at is not null then
      new.evaluation_at:=new.ends_at;
    end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

create function public.create_call_up_with_end(p_club_id uuid,p_starts_at timestamptz,
  p_ends_at timestamptz default null,p_last_notice_at timestamptz default null,
  p_status public.call_up_status default 'draft',p_closes_at timestamptz default null,p_ratings_enabled boolean default true)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups; v_end timestamptz;
begin
  select * into v_call from public.create_call_up_with_schedule(p_club_id,p_starts_at,p_last_notice_at,p_status,p_closes_at);
  v_end:=coalesce(p_ends_at,v_call.ends_at);
  if v_end<=p_starts_at or p_ratings_enabled is null then raise exception 'Invalid call-up end' using errcode='22023'; end if;
  update public.call_ups set ends_at=v_end,evaluation_at=case when p_ratings_enabled then v_end end
    where id=v_call.id returning * into v_call;
  return v_call;
end;
$$;
create function public.update_call_up_with_end(p_call_up_id uuid,p_starts_at timestamptz,p_status public.call_up_status,
  p_ends_at timestamptz,p_last_notice_at timestamptz default null,p_closes_at timestamptz default null,p_ratings_enabled boolean default true)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club for update;
  if not found then raise exception 'Call-up unavailable' using errcode='42501'; end if;
  if v_call.ends_at<=clock_timestamp() then raise exception 'Call-up finished' using errcode='P0042'; end if;
  if p_ends_at is null or p_ends_at<=p_starts_at or p_ratings_enabled is null then raise exception 'Invalid call-up end' using errcode='22023'; end if;
  perform public.update_call_up_with_evaluation(p_call_up_id,p_starts_at,p_status,p_last_notice_at,p_closes_at,null);
  update public.call_ups set ends_at=p_ends_at,evaluation_at=case when p_ratings_enabled then p_ends_at end
    where id=p_call_up_id returning * into v_call;
  return v_call;
end;
$$;
revoke all on function public.create_call_up_with_end(uuid,timestamptz,timestamptz,timestamptz,public.call_up_status,timestamptz,boolean),
 public.update_call_up_with_end(uuid,timestamptz,public.call_up_status,timestamptz,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.create_call_up_with_end(uuid,timestamptz,timestamptz,timestamptz,public.call_up_status,timestamptz,boolean),
 public.update_call_up_with_end(uuid,timestamptz,public.call_up_status,timestamptz,timestamptz,timestamptz,boolean) to authenticated;

-- Members must still see a live call after voting closes, including after midnight.
alter policy call_ups_read on public.call_ups using (
 private.is_admin(club_id) or (status in ('open','closed') and private.is_member(club_id) and ends_at>now())
);


-- End time replaces the former local-day boundary.
create or replace function public.respond_to_call_up(p_call_up_player_id uuid,p_availability public.availability_status)
returns public.call_up_players language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_entry public.call_up_players; v_call public.call_ups; v_club uuid; v_event uuid;
begin
  select club_id into v_club from public.call_up_players where id=p_call_up_player_id;
  perform 1 from public.clubs where id=v_club for update;
  select c.* into v_call from public.call_ups c join public.call_up_players s on s.call_up_id=c.id where s.id=p_call_up_player_id for update of c;
  select * into v_entry from public.call_up_players where id=p_call_up_player_id for update;
  if not found or v_entry.user_id is distinct from v_user or not private.is_member(v_entry.club_id)
    or v_call.status<>'open' or v_call.ends_at<=clock_timestamp() then
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


-- End time replaces the former local-day boundary.
create or replace function private.can_manage_call_up(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.call_ups c where c.id=p_id and c.status in ('draft','open')
    and c.ends_at>clock_timestamp() and private.is_admin(c.club_id));
$$;


-- End time replaces the former local-day boundary.
create or replace function public.list_call_up_history(p_club_id uuid)
returns setof public.call_ups language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query select c.* from public.call_ups c where c.club_id = p_club_id
    and c.ends_at<=clock_timestamp()
    order by c.starts_at desc, c.id desc limit 10;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function public.prepare_call_up_push(p_club_id uuid, p_call_up_id uuid, p_event_key text, p_kind text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_call public.call_ups; v_event public.push_events; 
begin
  perform 1 from public.clubs where id=p_club_id for update;
  select * into v_call from public.call_ups where club_id=p_club_id and id=p_call_up_id for update;
  if not found or v_call.status<>'open' or v_call.ends_at<=clock_timestamp() then
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


-- End time replaces the former local-day boundary.
create or replace function public.refresh_call_up_roster(p_call_up_id uuid, p_reopen boolean default false)
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid; v_call public.call_ups;
begin
  select club_id into v_club_id from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club_id for update;
  perform private.require_admin(v_club_id);
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club_id for update;
  if not found or p_reopen is null or v_call.ends_at<=clock_timestamp()
    or (p_reopen and v_call.status<>'cancelled')
    or (not p_reopen and v_call.status not in ('draft','open')) then
    raise exception 'Roster refresh unavailable for this call-up' using errcode='22023';
  end if;

  delete from public.call_up_players s where s.call_up_id=v_call.id and s.club_id=v_club_id
    and not exists (select 1 from public.players p where p.id=s.source_player_id and p.club_id=v_club_id and p.is_active);

  insert into public.call_up_players as snapshot
    (club_id,call_up_id,source_player_id,user_id,ea_id_snapshot,jersey_number_snapshot,position_snapshot,category_snapshot,sort_order_snapshot)
    select p.club_id,v_call.id,p.id,case when m.is_active then p.user_id end,
      p.ea_id,p.jersey_number,p.position,p.category,p.sort_order
    from public.players p left join public.club_members m on m.club_id=p.club_id and m.user_id=p.user_id
    where p.club_id=v_club_id and p.is_active
  on conflict (call_up_id,source_player_id) do update set
    user_id=excluded.user_id,ea_id_snapshot=excluded.ea_id_snapshot,jersey_number_snapshot=excluded.jersey_number_snapshot,
    position_snapshot=excluded.position_snapshot,category_snapshot=excluded.category_snapshot,sort_order_snapshot=excluded.sort_order_snapshot,
    availability=case when snapshot.user_id is not distinct from excluded.user_id and excluded.user_id is not null
      then snapshot.availability else 'unanswered'::public.availability_status end,
    responded_at=case when snapshot.user_id is not distinct from excluded.user_id and excluded.user_id is not null
      then snapshot.responded_at else null end,updated_at=now();

  delete from public.call_up_trials s where s.call_up_id=v_call.id and s.club_id=v_club_id
    and not exists (select 1 from public.club_trials t where t.id=s.source_trial_id and t.club_id=v_club_id and t.status='active');
  insert into public.call_up_trials
    (club_id,call_up_id,source_trial_id,ea_id_snapshot,jersey_number_snapshot,position_snapshot,notes_snapshot,sort_order_snapshot,trial_created_at)
    select club_id,v_call.id,id,ea_id,jersey_number,position,notes,sort_order,created_at
    from public.club_trials where club_id=v_club_id and status='active'
  on conflict (call_up_id,source_trial_id) do update set
    ea_id_snapshot=excluded.ea_id_snapshot,jersey_number_snapshot=excluded.jersey_number_snapshot,
    position_snapshot=excluded.position_snapshot,notes_snapshot=excluded.notes_snapshot,
    sort_order_snapshot=excluded.sort_order_snapshot,trial_created_at=excluded.trial_created_at;

  update public.call_ups set status=case when p_reopen then 'open'::public.call_up_status else status end,
    updated_at=now() where id=v_call.id and club_id=v_club_id returning * into v_call;
  return v_call;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function private.enqueue_call_up_lifecycle_push() returns trigger language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups; v_event uuid; v_kind text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return null; end if;
  if new.status not in ('open','cancelled') then return null; end if;
  select * into v_call from public.call_ups where id=new.id for update;
  if not found or v_call.status_version<>new.status_version or v_call.status<>new.status
    or v_call.ends_at<=clock_timestamp() then return null; end if;
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


-- End time replaces the former local-day boundary.
create or replace function public.add_call_up_trial(p_call_up_id uuid, p_name text, p_notes text default null)
returns public.call_up_trials language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_call public.call_ups; v_trial public.club_trials; v_snapshot public.call_up_trials;
begin
  select club_id into v_club from public.call_ups where id = p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id = v_club for update;
  select * into v_call from public.call_ups where id = p_call_up_id for update;
  if not found or v_call.status not in ('open', 'draft')
    or v_call.ends_at<=clock_timestamp() then
    raise exception 'Call-up is read only' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 64
    or char_length(p_notes) > 1000 then
    raise exception 'Invalid trial' using errcode = '22023';
  end if;
  insert into public.club_trials(club_id, ea_id, notes)
    values(v_club, btrim(p_name), nullif(btrim(p_notes), '')) returning * into v_trial;
  insert into public.call_up_trials(club_id, call_up_id, source_trial_id, ea_id_snapshot,
    jersey_number_snapshot, position_snapshot, notes_snapshot, sort_order_snapshot, trial_created_at)
    values(v_club, v_call.id, v_trial.id, v_trial.ea_id, null, null, v_trial.notes, v_trial.sort_order, v_trial.created_at)
    returning * into v_snapshot;
  return v_snapshot;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function public.restart_call_up(p_call_up_id uuid, p_expected_version integer)
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_call public.call_ups;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id=v_club for update;
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club for update;
  if not found or v_call.ends_at<=clock_timestamp() then
    raise exception 'Call-up unavailable' using errcode='42501';
  end if;
  if p_expected_version is null or p_expected_version<>v_call.status_version then
    raise exception 'Call-up changed' using errcode='40001';
  end if;

  update public.push_deliveries d set state='skipped'
    from public.push_events e where d.event_id=e.id and e.call_up_id=v_call.id
      and e.club_id=v_club and d.state='pending';

  update public.call_ups set status='draft' where id=v_call.id;
  perform public.refresh_call_up_roster(v_call.id,false);
  update public.call_up_players set availability='unanswered',responded_at=null,
    availability_version=availability_version+1,updated_at=clock_timestamp()
    where club_id=v_club and call_up_id=v_call.id;
  update public.call_ups set status='open',updated_at=clock_timestamp()
    where id=v_call.id returning * into v_call;
  return v_call;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function public.save_call_up_contact(p_call_up_id uuid,p_kind text,p_entry_id uuid,p_phone text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups; v_source uuid; v_phone text:=nullif(btrim(p_phone),'');
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id=v_club for update;
  select * into v_call from public.call_ups where id=p_call_up_id for update;
  if v_call.status not in ('open','draft') or v_call.ends_at<=clock_timestamp() then raise exception 'Read only call-up' using errcode='42501'; end if;
  if v_phone is not null and (char_length(v_phone)>16 or v_phone !~ '^\+[1-9][0-9]{6,14}$') then raise exception 'Invalid phone' using errcode='22023'; end if;
  if p_kind='trial' then
    select source_trial_id into v_source from public.call_up_trials where id=p_entry_id and club_id=v_club and call_up_id=v_call.id;
    if not found then raise exception 'Trial mismatch' using errcode='42501'; end if;
    delete from public.call_up_contacts where trial_id=p_entry_id;
    if v_source is not null then
      delete from public.club_trial_contacts where trial_id=v_source and club_id=v_club;
      if v_phone is not null then insert into public.club_trial_contacts values(v_source,v_club,v_phone); end if;
    end if;
    if v_phone is not null then insert into public.call_up_contacts(club_id,call_up_id,trial_id,phone) values(v_club,v_call.id,p_entry_id,v_phone); end if;
  elsif p_kind='aid' then
    if not exists(select 1 from public.call_up_aids where id=p_entry_id and club_id=v_club and call_up_id=v_call.id) then raise exception 'Aid mismatch' using errcode='42501'; end if;
    delete from public.call_up_contacts where aid_id=p_entry_id;
    if v_phone is not null then insert into public.call_up_contacts(club_id,call_up_id,aid_id,phone) values(v_club,v_call.id,p_entry_id,v_phone); end if;
  else raise exception 'Invalid contact kind' using errcode='22023'; end if;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function public.save_call_up_aid_with_contact(p_call_up_id uuid,p_body text,p_phone text default null,p_aid_id uuid default null)
returns public.call_up_aids language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups; v_aid public.call_up_aids;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id=v_club for update;
  select * into v_call from public.call_ups where id=p_call_up_id for update;
  if v_call.status not in ('open','draft') or v_call.ends_at<=clock_timestamp() then raise exception 'Read only call-up' using errcode='42501'; end if;
  if p_aid_id is null then
    insert into public.call_up_aids(club_id,call_up_id,body) values(v_club,v_call.id,p_body) returning * into v_aid;
  else
    update public.call_up_aids set body=p_body where id=p_aid_id and club_id=v_club and call_up_id=v_call.id returning * into v_aid;
    if not found then raise exception 'Aid mismatch' using errcode='42501'; end if;
  end if;
  perform public.save_call_up_contact(v_call.id,'aid',v_aid.id,p_phone);
  return v_aid;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function public.remove_call_up_trial(p_trial_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_trial public.call_up_trials; v_call public.call_ups;
begin
  select * into v_trial from public.call_up_trials where id=p_trial_id;
  perform private.require_admin(v_trial.club_id);
  perform 1 from public.clubs where id=v_trial.club_id for update;
  select * into v_call from public.call_ups where id=v_trial.call_up_id for update;
  if v_call.status not in ('open','draft') or v_call.ends_at<=clock_timestamp() then raise exception 'Read only call-up' using errcode='42501'; end if;
  if v_trial.source_trial_id is not null then
    insert into public.call_up_trial_exclusions values(v_trial.club_id,v_trial.call_up_id,v_trial.source_trial_id) on conflict do nothing;
  end if;
  delete from public.call_up_trials where id=v_trial.id and club_id=v_trial.club_id;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function public.set_club_decision_lock(p_club_id uuid,p_enabled boolean,p_call_up_player_id uuid default null)
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
  if v_call.status='cancelled' or v_call.ends_at<=clock_timestamp() or v_entry.availability='unanswered' then
    raise exception 'Vote before keeping your decision' using errcode='22023';
  end if;
  insert into public.club_decision_locks(club_id,user_id,availability) values(p_club_id,v_user,v_entry.availability)
  on conflict(club_id,user_id) do update set availability=excluded.availability,updated_at=clock_timestamp();
  return true;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function private.apply_retained_decision() returns trigger
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
  if v_call.ends_at<=clock_timestamp() or v_call.starts_at<v_lock.created_at then return new; end if;
  new.availability:=v_lock.availability;
  new.responded_at:=clock_timestamp();
  new.auto_response:=true;
  return new;
end;
$$;


-- End time replaces the former local-day boundary.
create or replace function private.sync_new_player_to_open_calls() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_call public.call_ups;
begin
  if not new.is_active then return new; end if;
  if tg_op='UPDATE' and old.is_active and new.user_id is not distinct from old.user_id then return new; end if;
  select m.user_id into v_user from public.club_members m
    where m.club_id=new.club_id and m.user_id=new.user_id and m.is_active;
  for v_call in select * from public.call_ups c where c.club_id=new.club_id and c.status='open'
    and c.ends_at>clock_timestamp()
    order by c.id for update loop
    insert into public.call_up_players as snapshot
      (club_id,call_up_id,source_player_id,user_id,ea_id_snapshot,jersey_number_snapshot,position_snapshot,category_snapshot,sort_order_snapshot)
    values(new.club_id,v_call.id,new.id,v_user,new.ea_id,new.jersey_number,new.position,new.category,new.sort_order)
    on conflict(call_up_id,source_player_id) do update set
      user_id=excluded.user_id,
      availability=case when snapshot.user_id is not distinct from excluded.user_id then snapshot.availability else 'unanswered'::public.availability_status end,
      responded_at=case when snapshot.user_id is not distinct from excluded.user_id then snapshot.responded_at else null end,
      updated_at=clock_timestamp()
    where snapshot.user_id is distinct from excluded.user_id;
  end loop;
  return new;
end;
$$;


-- End time replaces the former local-day boundary.
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
    or (v_event.kind not in ('cancelled','evaluation') and (v_call.status<>'open' or v_call.closes_at<=clock_timestamp() or v_call.ends_at<=clock_timestamp()))
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


-- Repair deployments that predate the call-up publication while keeping existing
-- membership/request subscriptions and any managed publication configuration.
do $$
declare v_table text;
begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication where pubname='supabase_realtime' and puballtables) then
    foreach v_table in array array['call_ups','call_up_players','call_up_trials','call_up_aids'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
        execute format('alter publication supabase_realtime add table public.%I',v_table);
      end if;
    end loop;
  end if;
end;
$$;

notify pgrst,'reload schema';
commit;
