begin;

create function public.leave_club(p_club_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_member public.club_members;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  select * into v_member from public.club_members
    where club_id = p_club_id and user_id = v_user for update;

  if not found or not v_member.is_active then
    raise exception 'Active membership not found' using errcode = '22023';
  end if;
  if v_member.role <> 'player' then
    raise exception 'Captains must transfer their role before leaving' using errcode = '42501';
  end if;

  -- Preserve completed call-up snapshots while removing this player from the
  -- current roster and any call-up that has not finished yet.
  delete from public.call_up_players snapshot
  using public.call_ups call_up
  where snapshot.call_up_id = call_up.id
    and snapshot.club_id = p_club_id
    and snapshot.user_id = v_user
    and call_up.club_id = p_club_id
    and call_up.status in ('draft', 'open', 'closed')
    and call_up.ends_at > clock_timestamp();

  update public.players set is_active = false
    where club_id = p_club_id and user_id = v_user and is_active;
  update public.club_members set is_active = false
    where id = v_member.id;
end;
$$;

revoke all on function public.leave_club(uuid) from public, anon;
grant execute on function public.leave_club(uuid) to authenticated;
notify pgrst, 'reload schema';

commit;
