begin;

alter table public.club_lineup_preferences add column player_color text not null default '#B4F16C'
  check (player_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.club_lineup_preferences alter column custom_formation drop not null;
alter table public.club_lineup_preferences alter column custom_slots drop not null;
alter table public.club_lineup_preferences add constraint club_lineup_preferences_layout_pair
  check ((custom_formation is null) = (custom_slots is null));

create or replace function public.read_lineup_preference(p_club_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_preference public.club_lineup_preferences;
begin
  if p_club_id is null or not private.is_member(p_club_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select * into v_preference from public.club_lineup_preferences where club_id=p_club_id;
  if not found then return jsonb_build_object('playerColor', '#B4F16C'); end if;
  return jsonb_strip_nulls(jsonb_build_object('formation', v_preference.custom_formation, 'slots', v_preference.custom_slots, 'playerColor', v_preference.player_color));
end;
$$;

create or replace function public.delete_lineup_preference(p_club_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  update public.club_lineup_preferences set custom_formation=null,custom_slots=null,updated_at=now() where club_id=p_club_id;
end;
$$;

create function public.set_lineup_player_color(p_club_id uuid, p_color text)
returns text language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  if p_color is null or p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid player color' using errcode='22023'; end if;
  insert into public.club_lineup_preferences(club_id,player_color) values(p_club_id,upper(p_color))
  on conflict(club_id) do update set player_color=excluded.player_color,updated_at=now();
  return upper(p_color);
end;
$$;

revoke all on function public.set_lineup_player_color(uuid,text) from public, anon;
grant execute on function public.set_lineup_player_color(uuid,text) to authenticated;

commit;
