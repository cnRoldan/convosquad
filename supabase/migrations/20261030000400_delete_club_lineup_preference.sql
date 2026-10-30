begin;

create function public.delete_lineup_preference(p_club_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  delete from public.club_lineup_preferences where club_id=p_club_id;
end;
$$;

revoke all on function public.delete_lineup_preference(uuid) from public, anon;
grant execute on function public.delete_lineup_preference(uuid) to authenticated;

commit;
