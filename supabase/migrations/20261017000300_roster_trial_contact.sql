-- Save roster trial details and its captain-only phone in one transaction.
-- Existing call-up snapshots retain their original contact information.
create function public.save_club_trial_with_contact(
  p_club_id uuid, p_name text, p_notes text default null,
  p_phone text default null, p_trial_id uuid default null
) returns public.club_trials
language plpgsql security definer set search_path = '' as $$
declare
  v_trial public.club_trials;
  v_phone text := nullif(btrim(p_phone), '');
begin
  perform private.require_admin(p_club_id);
  perform 1 from public.clubs where id = p_club_id for update;
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{6,14}$' then
    raise exception 'Invalid phone' using errcode = '22023';
  end if;
  if p_trial_id is null then
    insert into public.club_trials(club_id, ea_id, notes)
    values(p_club_id, btrim(p_name), nullif(btrim(p_notes), '')) returning * into v_trial;
  else
    select * into v_trial from public.club_trials
    where id = p_trial_id and club_id = p_club_id and status = 'active' for update;
    if not found then raise exception 'Trial mismatch' using errcode = '42501'; end if;
    update public.club_trials set ea_id = btrim(p_name), notes = nullif(btrim(p_notes), '')
    where id = v_trial.id returning * into v_trial;
  end if;
  delete from public.club_trial_contacts where trial_id = v_trial.id and club_id = p_club_id;
  if v_phone is not null then
    insert into public.club_trial_contacts(trial_id, club_id, phone) values(v_trial.id, p_club_id, v_phone);
  end if;
  return v_trial;
end;
$$;
revoke all on function public.save_club_trial_with_contact(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.save_club_trial_with_contact(uuid,text,text,text,uuid) to authenticated;
