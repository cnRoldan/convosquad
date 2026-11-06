begin;

create function public.list_call_up_history_ratings(p_club_id uuid)
returns table(call_up_id uuid, average_score numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  if not private.has_club_premium(p_club_id) then return; end if;
  return query
    with matches as (
      select r.call_up_id,
        case when votes.total > 0 then votes.score_sum else r.score end as score_sum,
        case when votes.total > 0 then votes.scored else case when r.score is not null then 1 else 0 end end as scored
      from public.list_call_up_history(p_club_id) c
        join public.player_ratings r on r.call_up_id=c.id and r.club_id=c.club_id
        cross join lateral (
          select count(*) as total, count(v.score) as scored, sum(v.score) as score_sum
          from private.captain_player_ratings v where v.call_up_player_id=r.call_up_player_id
        ) votes
      where private.can_read_player_rating(r.club_id,r.call_up_player_id,r.player_id)
    )
    select m.call_up_id, round(sum(m.score_sum)::numeric / sum(m.scored), 2)
    from matches m group by m.call_up_id having sum(m.scored) > 0;
end;
$$;
revoke all on function public.list_call_up_history_ratings(uuid) from public, anon;
grant execute on function public.list_call_up_history_ratings(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
