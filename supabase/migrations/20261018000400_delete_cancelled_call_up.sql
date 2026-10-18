begin;

create function public.delete_cancelled_call_up(p_call_up_id uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club for update;
  if not found then raise exception 'Call-up unavailable' using errcode='42501'; end if;
  if p_expected_version is null or p_expected_version<>v_call.status_version then
    raise exception 'Call-up changed' using errcode='40001';
  end if;
  if v_call.status<>'cancelled' then raise exception 'Cancel the call-up before deleting it' using errcode='22023'; end if;
  -- Scoped foreign keys remove snapshots, private contacts, grades and queued notices.
  -- The club roster and personal retained decisions belong to the club and survive.
  delete from public.call_ups where id=v_call.id and club_id=v_club;
end;
$$;
revoke all on function public.delete_cancelled_call_up(uuid,integer) from public,anon,authenticated;
grant execute on function public.delete_cancelled_call_up(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
