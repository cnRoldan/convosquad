begin;

create function public.delete_player_incident(p_incident_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare club uuid;
begin
 perform private.require_user();
 select club_id into club from public.player_incidents where id=p_incident_id;
 if not found then return; end if;
 perform private.require_admin(club);
 -- Serialize with incident recording and lineup publication.
 perform 1 from public.clubs where id=club for update;
 perform private.require_admin(club);
 delete from public.player_incidents where id=p_incident_id and club_id=club;
end; $$;
revoke all on function public.delete_player_incident(uuid) from public,anon;
grant execute on function public.delete_player_incident(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
