begin;

alter table public.club_lineup_preferences add column jersey_color text not null default '#0B1210'
  check (jersey_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.read_lineup_preference(p_club_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_preference public.club_lineup_preferences;
begin
  if p_club_id is null or not private.is_member(p_club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v_preference from public.club_lineup_preferences where club_id=p_club_id;
  if not found then return jsonb_build_object('playerColor','#B4F16C','jerseyColor','#0B1210'); end if;
  return jsonb_strip_nulls(jsonb_build_object('formation',v_preference.custom_formation,'slots',v_preference.custom_slots,'playerColor',v_preference.player_color,'jerseyColor',v_preference.jersey_color));
end;
$$;

create function public.set_lineup_player_colors(p_club_id uuid,p_player_color text,p_jersey_color text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  if p_player_color is null or p_player_color !~ '^#[0-9A-Fa-f]{6}$' or p_jersey_color is null or p_jersey_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid lineup color' using errcode='22023';
  end if;
  insert into public.club_lineup_preferences(club_id,player_color,jersey_color) values(p_club_id,upper(p_player_color),upper(p_jersey_color))
  on conflict(club_id) do update set player_color=excluded.player_color,jersey_color=excluded.jersey_color,updated_at=now();
  return jsonb_build_object('playerColor',upper(p_player_color),'jerseyColor',upper(p_jersey_color));
end;
$$;

revoke all on function public.set_lineup_player_colors(uuid,text,text) from public,anon;
grant execute on function public.set_lineup_player_colors(uuid,text,text) to authenticated;
commit;
