begin;

create function public.restart_call_up(p_call_up_id uuid, p_expected_version integer)
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_club uuid; v_call public.call_ups;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id=v_club for update;
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club for update;
  if not found or v_call.local_date<(now() at time zone v_call.timezone)::date then
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
revoke all on function public.restart_call_up(uuid,integer) from public, anon, authenticated;
grant execute on function public.restart_call_up(uuid,integer) to authenticated;
notify pgrst, 'reload schema';

commit;
