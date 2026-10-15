begin;

create function public.refresh_call_up_roster(p_call_up_id uuid, p_reopen boolean default false)
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid; v_call public.call_ups;
begin
  select club_id into v_club_id from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club_id for update;
  perform private.require_admin(v_club_id);
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club_id for update;
  if not found or p_reopen is null or v_call.local_date<(now() at time zone v_call.timezone)::date
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
revoke all on function public.refresh_call_up_roster(uuid,boolean) from public, anon;
grant execute on function public.refresh_call_up_roster(uuid,boolean) to authenticated;

commit;
