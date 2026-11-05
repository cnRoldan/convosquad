begin;

-- Weight each saved numeric captain vote equally, while counting matches once.
create or replace function public.get_player_performance(p_club_id uuid,p_period text default '3m')
returns table(player_id uuid,player_name text,average_score numeric,rated_matches integer,not_selected_matches integer,last_match_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz;
begin
 if not private.is_member(p_club_id) or not (private.is_admin(p_club_id) or exists(select 1 from public.clubs c where c.id=p_club_id and c.ratings_visibility in ('self','members'))) then raise exception 'Not authorized to read ratings' using errcode='42501'; end if;
 cutoff:=case p_period when '7d' then now()-interval '7 days' when '1m' then now()-interval '1 month' when '3m' then now()-interval '3 months' else null end;
 if cutoff is null then raise exception 'Invalid period' using errcode='22023'; end if;
 return query
 with matches as (
  select r.*,c.starts_at,
   case when v.total_votes>0 then v.score_sum else r.score end as score_sum,
   case when v.total_votes>0 then v.scored_votes else case when r.score is not null then 1 else 0 end end as scored_votes
  from public.player_ratings r join public.call_ups c on c.id=r.call_up_id and c.club_id=r.club_id
  cross join lateral (
   select count(*) as total_votes,count(vote.score) as scored_votes,sum(vote.score) as score_sum
   from private.captain_player_ratings vote where vote.call_up_player_id=r.call_up_player_id
  ) v
  where r.club_id=p_club_id and private.can_read_player_rating(r.club_id,r.call_up_player_id,r.player_id)
   and c.starts_at>=cutoff and c.starts_at<=now() and c.status in ('open','closed') and c.evaluation_at<=now()
 )
 select m.player_id,(array_agg(m.player_name order by m.starts_at desc,m.updated_at desc))[1],
  round(sum(m.score_sum)::numeric/nullif(sum(m.scored_votes),0),2),
  count(m.score)::integer,(count(*) filter(where m.not_selected))::integer,max(m.starts_at)
 from matches m group by m.player_id
 order by sum(m.score_sum)::numeric/nullif(sum(m.scored_votes),0) desc nulls last,count(m.score) desc,
  lower((array_agg(m.player_name order by m.starts_at desc,m.updated_at desc))[1]);
end; $$;
notify pgrst,'reload schema';
commit;
