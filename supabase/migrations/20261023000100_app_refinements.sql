alter table public.club_trials add column resolved_at timestamptz;

update public.club_trials
set resolved_at = case
  when status = 'incorporated' then coalesce(incorporated_at, created_at)
  when status = 'withdrawn' then created_at
  else null
end;

create index club_trials_history on public.club_trials(club_id, resolved_at desc)
where status <> 'active';

create function private.reserve_trial_history_slot(p_club_id uuid, p_trial_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.club_trials
  where club_id = p_club_id
    and status <> 'active'
    and resolved_at < clock_timestamp() - interval '12 months';

  if (select count(*) from public.club_trials
      where club_id = p_club_id and status <> 'active'
        and resolved_at >= clock_timestamp() - interval '12 months'
        and id <> p_trial_id) >= 6 then
    raise exception 'Trial history is full' using errcode = 'P0043';
  end if;
end;
$$;
revoke all on function private.reserve_trial_history_slot(uuid, uuid) from public, anon, authenticated;

create or replace function public.withdraw_trial(p_trial_id uuid) returns public.club_trials
language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_trial public.club_trials;
begin
  select club_id into v_club from public.club_trials where id = p_trial_id;
  perform 1 from public.clubs where id = v_club for update;
  perform private.require_admin(v_club);
  perform private.reserve_trial_history_slot(v_club, p_trial_id);
  update public.club_trials set status = 'withdrawn', resolved_at = clock_timestamp()
  where id = p_trial_id and status = 'active' returning * into v_trial;
  if not found then raise exception 'Trial is not active' using errcode = '22023'; end if;
  return v_trial;
end;
$$;

create or replace function public.promote_trial(p_trial_id uuid, p_category public.roster_category, p_existing_player_id uuid default null)
returns public.players language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_trial public.club_trials; v_player public.players;
begin
  select club_id into v_club from public.club_trials where id = p_trial_id;
  perform 1 from public.clubs where id = v_club for update;
  perform private.require_admin(v_club);
  select * into v_trial from public.club_trials where id = p_trial_id and status = 'active' for update;
  if not found or p_category is null then raise exception 'Trial is not active or category missing' using errcode = '22023'; end if;
  perform private.reserve_trial_history_slot(v_club, p_trial_id);
  if p_existing_player_id is null then
    insert into public.players(club_id, ea_id, jersey_number, category)
    values (v_club, v_trial.ea_id, v_trial.jersey_number, p_category) returning * into v_player;
  else
    select * into v_player from public.players where id = p_existing_player_id and club_id = v_club for update;
    if not found or lower(btrim(v_player.ea_id)) <> lower(v_trial.ea_id) then
      raise exception 'Existing player does not match this trial' using errcode = '22023';
    end if;
    update public.players set category = p_category,
      jersey_number = coalesce(jersey_number, v_trial.jersey_number), is_active = true
    where id = v_player.id returning * into v_player;
  end if;
  update public.club_trials set status = 'incorporated', player_id = v_player.id,
    incorporated_at = clock_timestamp(), resolved_at = clock_timestamp()
  where id = v_trial.id;
  return v_player;
end;
$$;

create function public.delete_trial_history(p_trial_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_club uuid;
begin
  select club_id into v_club from public.club_trials where id = p_trial_id and status <> 'active' for update;
  if not found then raise exception 'Trial history item not found' using errcode = '22023'; end if;
  perform 1 from public.clubs where id = v_club for update;
  perform private.require_admin(v_club);
  delete from public.club_trials where id = p_trial_id and status <> 'active';
end;
$$;

create function public.sync_call_up_trial_from_roster(p_call_up_id uuid, p_trial_id uuid)
returns public.call_up_trials language plpgsql security definer set search_path = '' as $$
declare v_call public.call_ups; v_trial public.club_trials; v_snapshot public.call_up_trials; v_notes text;
begin
  select * into v_call from public.call_ups where id = p_call_up_id for update;
  if not found or v_call.status not in ('draft', 'open') or v_call.ends_at <= clock_timestamp() then
    raise exception 'Call-up is immutable' using errcode = '42501';
  end if;
  perform private.require_admin(v_call.club_id);
  select * into v_trial from public.club_trials where id = p_trial_id and club_id = v_call.club_id and status = 'active';
  if not found then raise exception 'Trial is not active' using errcode = '22023'; end if;
  select notes into v_notes from public.club_trial_notes where club_id = v_call.club_id and trial_id = p_trial_id;
  update public.call_up_trials set ea_id_snapshot = v_trial.ea_id,
    jersey_number_snapshot = v_trial.jersey_number, position_snapshot = v_trial.position,
    notes_snapshot = v_notes, sort_order_snapshot = v_trial.sort_order
  where call_up_id = p_call_up_id and source_trial_id = p_trial_id returning * into v_snapshot;
  if not found then raise exception 'Trial is not part of this call-up' using errcode = '22023'; end if;
  delete from public.call_up_contacts where trial_id = v_snapshot.id;
  insert into public.call_up_contacts(club_id, call_up_id, trial_id, phone)
  select v_call.club_id, p_call_up_id, v_snapshot.id, phone
  from public.club_trial_contacts where club_id = v_call.club_id and trial_id = p_trial_id;
  return v_snapshot;
end;
$$;

create function public.get_call_up_player_totals(p_club_id uuid)
returns table(player_id uuid, player_name text, total_call_ups bigint, available_count bigint,
  unavailable_count bigint, backup_count bigint, unanswered_count bigint, average_response_seconds numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query
  select p.source_player_id,
    (array_agg(p.ea_id_snapshot order by c.starts_at desc))[1],
    count(*)::bigint,
    count(*) filter (where p.availability = 'available')::bigint,
    count(*) filter (where p.availability = 'unavailable')::bigint,
    count(*) filter (where p.availability = 'backup')::bigint,
    count(*) filter (where p.availability = 'unanswered')::bigint,
    round(avg(extract(epoch from (p.responded_at - c.created_at)))
      filter (where p.responded_at is not null and not p.auto_response and p.availability <> 'unanswered'))::numeric
  from public.call_up_players p
  join public.call_ups c on c.id = p.call_up_id and c.club_id = p_club_id
  where p.source_player_id is not null and c.status in ('open', 'closed') and c.ends_at <= clock_timestamp()
  group by p.source_player_id;
end;
$$;

revoke all on function public.delete_trial_history(uuid), public.sync_call_up_trial_from_roster(uuid, uuid),
  public.get_call_up_player_totals(uuid) from public, anon;
grant execute on function public.delete_trial_history(uuid), public.sync_call_up_trial_from_roster(uuid, uuid),
  public.get_call_up_player_totals(uuid) to authenticated;
