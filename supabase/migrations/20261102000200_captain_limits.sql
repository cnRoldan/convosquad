begin;

-- A free club may designate the creator plus one more captain. Premium
-- removes that quota; the check lives here so it cannot be bypassed via API.
create or replace function public.set_club_member(p_club_id uuid, p_user_id uuid, p_role public.club_role, p_is_active boolean)
returns public.club_members language plpgsql security definer set search_path = '' as $$
declare v_member public.club_members;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  select * into v_member from public.club_members where club_id = p_club_id and user_id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = '22023'; end if;
  if v_member.role = 'admin' and v_member.is_active and (p_role <> 'admin' or not p_is_active)
    and (select count(*) from public.club_members where club_id = p_club_id and role = 'admin' and is_active) = 1 then
    raise exception 'Cannot remove the last active admin' using errcode = '23514';
  end if;
  if p_role = 'admin' and p_is_active and (v_member.role <> 'admin' or not v_member.is_active)
    and not private.has_club_premium(p_club_id)
    and (select count(*) from public.club_members where club_id = p_club_id and role = 'admin' and is_active) >= 2 then
    raise exception 'Premium is required for more than two captains' using errcode = 'P0001';
  end if;
  update public.club_members set role = p_role, is_active = p_is_active where id = v_member.id returning * into v_member;
  return v_member;
end;
$$;

commit;
