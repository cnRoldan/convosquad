begin;

alter table public.club_lineup_preferences add column position_locked boolean not null default true;

create or replace function public.read_lineup_preference(p_club_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_preference public.club_lineup_preferences;
begin
  if p_club_id is null or not private.is_member(p_club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_preference from public.club_lineup_preferences where club_id=p_club_id;
  if not found then return jsonb_build_object('playerColor','#B4F16C','jerseyColor','#0B1210','positionLocked',true); end if;
  return jsonb_strip_nulls(jsonb_build_object('formation',v_preference.custom_formation,'slots',v_preference.custom_slots,'playerColor',v_preference.player_color,'jerseyColor',v_preference.jersey_color,'positionLocked',v_preference.position_locked));
end;
$$;

create function public.set_lineup_position_lock(p_club_id uuid,p_locked boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  if p_locked is null then raise exception 'Invalid position lock' using errcode='22023'; end if;
  insert into public.club_lineup_preferences(club_id,position_locked) values(p_club_id,p_locked)
  on conflict(club_id) do update set position_locked=excluded.position_locked,updated_at=now();
  return p_locked;
end;
$$;

revoke all on function public.set_lineup_position_lock(uuid,boolean) from public,anon;
grant execute on function public.set_lineup_position_lock(uuid,boolean) to authenticated;
commit;
