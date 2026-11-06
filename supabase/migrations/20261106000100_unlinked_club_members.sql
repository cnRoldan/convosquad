begin;

create function public.list_unlinked_club_members(p_club_id uuid)
returns table(user_id uuid, username text, role public.club_role, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query
    select m.user_id, p.username, m.role, m.created_at
    from public.club_members m join public.profiles p on p.id = m.user_id
    where m.club_id = p_club_id and m.is_active
      and not exists (select 1 from public.players player where player.club_id = m.club_id and player.user_id = m.user_id)
    order by m.created_at, m.user_id;
end;
$$;

create function public.remove_unlinked_club_member(p_club_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_member public.club_members;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_user_id = private.require_user() then
    raise exception 'Cannot remove your own membership' using errcode = '42501';
  end if;
  select * into v_member from public.club_members
    where club_id = p_club_id and user_id = p_user_id for update;
  if not found or not v_member.is_active then return; end if;
  -- Linking and removing members both take the club lock. Recheck at confirmation
  -- time so a stale list can never remove someone who now has a player card.
  if exists(select 1 from public.players where club_id = p_club_id and user_id = p_user_id) then
    raise exception 'La cuenta ya tiene una ficha de jugador vinculada.' using errcode = '22023';
  end if;
  perform public.set_club_member(p_club_id, p_user_id, v_member.role, false);
  update public.player_link_requests set status = 'rejected'
    where club_id = p_club_id and user_id = p_user_id and status = 'pending';
end;
$$;

revoke all on function public.list_unlinked_club_members(uuid), public.remove_unlinked_club_member(uuid, uuid) from public, anon;
grant execute on function public.list_unlinked_club_members(uuid), public.remove_unlinked_club_member(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
