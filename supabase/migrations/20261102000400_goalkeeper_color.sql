begin;
alter table public.club_lineup_preferences add column goalkeeper_color text not null default '#F4A83A' check (goalkeeper_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.read_lineup_preference(p_club_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.club_lineup_preferences;
begin
  if p_club_id is null or not private.is_member(p_club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into v from public.club_lineup_preferences where club_id=p_club_id;
  if not found then return jsonb_build_object('playerColor','#B4F16C','jerseyColor','#0B1210','goalkeeperColor','#F4A83A','positionLocked',true); end if;
  return jsonb_strip_nulls(jsonb_build_object('formation',v.custom_formation,'slots',v.custom_slots,'playerColor',v.player_color,'jerseyColor',v.jersey_color,'goalkeeperColor',v.goalkeeper_color,'positionLocked',v.position_locked));
end;
$$;

-- Keep the two-color RPC working for previously installed app versions.
create function public.set_lineup_kit_colors(p_club_id uuid,p_player_color text,p_jersey_color text,p_goalkeeper_color text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  if p_goalkeeper_color is null or p_goalkeeper_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid goalkeeper color' using errcode='22023'; end if;
  perform public.set_lineup_player_colors(p_club_id,p_player_color,p_jersey_color);
  update public.club_lineup_preferences set goalkeeper_color=upper(p_goalkeeper_color),updated_at=now() where club_id=p_club_id;
  return jsonb_build_object('playerColor',upper(p_player_color),'jerseyColor',upper(p_jersey_color),'goalkeeperColor',upper(p_goalkeeper_color));
end;
$$;
revoke all on function public.set_lineup_kit_colors(uuid,text,text,text) from public,anon;
grant execute on function public.set_lineup_kit_colors(uuid,text,text,text) to authenticated;
commit;
