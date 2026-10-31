begin;
drop function public.get_call_up_player_totals(uuid);
create function public.get_call_up_player_totals(p_club_id uuid)
returns table(player_id uuid, player_name text, total_call_ups bigint, available_count bigint,
  unavailable_count bigint, backup_count bigint, unanswered_count bigint, substitute_count bigint, average_response_seconds numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query
  select p.source_player_id,
    (array_agg(p.ea_id_snapshot order by c.starts_at desc))[1],
    count(*)::bigint,
    count(*) filter (where p.availability = 'available')::bigint,
    count(*) filter (where p.availability = 'unavailable')::bigint,
    count(*) filter (where p.availability = 'backup')::bigint,
    count(*) filter (where p.availability = 'unanswered')::bigint,
    count(*) filter (where p.availability in ('available','backup') and l.published is not null and not exists(
      select 1 from jsonb_array_elements(l.published->'slots') slot where slot->>'playerId'=p.source_player_id::text
    ))::bigint,
    round(avg(extract(epoch from (p.responded_at - c.created_at)))
      filter (where p.responded_at is not null and not p.auto_response and p.availability <> 'unanswered'))::numeric
  from public.call_up_players p
  join public.call_ups c on c.id = p.call_up_id and c.club_id = p_club_id
  left join public.call_up_lineups l on l.call_up_id=c.id and l.club_id=c.club_id and l.published is not null
  where p.source_player_id is not null and c.status in ('open', 'closed') and c.ends_at <= clock_timestamp()
  group by p.source_player_id;
end;
$$;
revoke all on function public.get_call_up_player_totals(uuid) from public,anon;
grant execute on function public.get_call_up_player_totals(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
