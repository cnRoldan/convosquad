begin;
drop function public.get_call_up_player_totals(uuid);
create function public.get_call_up_player_totals(p_club_id uuid)
returns table(player_id uuid, player_name text, total_call_ups bigint, available_count bigint,
  unavailable_count bigint, backup_count bigint, unanswered_count bigint, pending_non_backup_count bigint,
  substitute_count bigint, longest_unavailable_streak bigint, average_response_seconds numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query
  with entries as (
    select p.*,c.starts_at,c.created_at,l.published
    from public.call_up_players p join public.call_ups c on c.id=p.call_up_id and c.club_id=p_club_id
    left join public.call_up_lineups l on l.call_up_id=c.id and l.club_id=c.club_id and l.published is not null
    where p.source_player_id is not null and c.status in ('open','closed') and c.ends_at<=clock_timestamp()
  ), streak_groups as (
    select e.*,sum(case when e.availability='available' then 1 else 0 end) over(partition by e.source_player_id order by e.starts_at,e.call_up_id) as available_group
    from entries e
  ), streaks as (
    select source_player_id,count(*)::bigint as length from streak_groups where availability<>'available'
    group by source_player_id,available_group
  ), max_streaks as (
    select source_player_id,max(length)::bigint as length from streaks group by source_player_id
  )
  select e.source_player_id,
    (array_agg(e.ea_id_snapshot order by e.starts_at desc))[1],
    count(*)::bigint,
    count(*) filter (where e.availability='available')::bigint,
    count(*) filter (where e.availability='unavailable')::bigint,
    count(*) filter (where e.availability='backup')::bigint,
    count(*) filter (where e.availability='unanswered')::bigint,
    count(*) filter (where e.availability='unanswered' and e.category_snapshot<>'backups')::bigint,
    count(*) filter (where e.availability in ('available','backup') and e.published is not null and not exists(select 1 from jsonb_array_elements(e.published->'slots') slot where slot->>'playerId'=e.source_player_id::text))::bigint,
    coalesce(max(ms.length),0)::bigint,
    round(avg(extract(epoch from (e.responded_at-e.created_at))) filter(where e.responded_at is not null and not e.auto_response and e.availability<>'unanswered'))::numeric
  from entries e left join max_streaks ms on ms.source_player_id=e.source_player_id
  group by e.source_player_id;
end;
$$;
revoke all on function public.get_call_up_player_totals(uuid) from public,anon;
grant execute on function public.get_call_up_player_totals(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
