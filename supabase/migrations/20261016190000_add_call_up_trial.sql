begin;

create function public.add_call_up_trial(p_call_up_id uuid, p_name text, p_notes text default null)
returns public.call_up_trials language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_call public.call_ups; v_trial public.club_trials; v_snapshot public.call_up_trials;
begin
  select club_id into v_club from public.call_ups where id = p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id = v_club for update;
  select * into v_call from public.call_ups where id = p_call_up_id for update;
  if not found or v_call.status not in ('open', 'draft')
    or v_call.local_date < (now() at time zone v_call.timezone)::date then
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
revoke all on function public.add_call_up_trial(uuid,text,text) from public, anon, authenticated;
grant execute on function public.add_call_up_trial(uuid,text,text) to authenticated;
notify pgrst, 'reload schema';

commit;
