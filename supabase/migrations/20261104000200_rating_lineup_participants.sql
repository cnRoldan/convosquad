begin;

-- Ratings need the roster identities in the official XI, not the historical
-- formation, coordinates or image (whose consultation remains Premium).
create function public.read_rating_lineup(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups; document jsonb; entries jsonb;
begin
  select * into c from public.call_ups where id=p_call_id;
  if not found then raise exception 'Call-up not found' using errcode='22023'; end if;
  perform private.require_admin(c.club_id);
  select l.published into document from public.call_up_lineups l where l.call_up_id=c.id and l.club_id=c.club_id;
  select coalesce(jsonb_agg(distinct p.id),'[]'::jsonb) into entries
  from public.call_up_players p
  where p.call_up_id=c.id and p.club_id=c.club_id and p.source_player_id is not null
    and exists(select 1 from jsonb_array_elements(document->'slots') slot where slot->>'playerId'=p.source_player_id::text);
  return jsonb_build_object('published',document is not null,'entryIds',entries);
end;
$$;
revoke all on function public.read_rating_lineup(uuid) from public,anon;
grant execute on function public.read_rating_lineup(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
