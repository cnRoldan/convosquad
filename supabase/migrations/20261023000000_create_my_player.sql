begin;

-- Creating the captain's own roster record and linking it must succeed together.
create function public.create_my_player(p_club_id uuid,p_category public.roster_category,p_jersey_number smallint default null)
returns public.players language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_name text; v_player public.players;
begin
  perform 1 from public.clubs where id=p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_category is null or (p_jersey_number is not null and p_jersey_number not between 1 and 99) then
    raise exception 'Invalid player data' using errcode='22023';
  end if;
  select * into v_player from public.players where club_id=p_club_id and user_id=v_user for update;
  if found and v_player.is_active then return v_player; end if;
  if v_player.id is null then
    select username into v_name from public.profiles where id=v_user;
    if v_name is null then raise exception 'Profile required' using errcode='22023'; end if;
    select * into v_player from public.players where club_id=p_club_id and lower(ea_id)=lower(v_name) for update;
    if found and v_player.user_id is not null and v_player.user_id<>v_user then
      raise exception 'Player already linked' using errcode='23505';
    end if;
  end if;
  if v_player.id is null then
    insert into public.players(club_id,ea_id,category,jersey_number)
      values(p_club_id,v_name,p_category,p_jersey_number) returning * into v_player;
  else
    update public.players set is_active=true,category=p_category,jersey_number=coalesce(p_jersey_number,jersey_number)
      where id=v_player.id returning * into v_player;
  end if;
  return private.link_player(p_club_id,v_player.id,v_user);
end;
$$;
revoke all on function public.create_my_player(uuid,public.roster_category,smallint) from public,anon,authenticated;
grant execute on function public.create_my_player(uuid,public.roster_category,smallint) to authenticated;
notify pgrst,'reload schema';
commit;
