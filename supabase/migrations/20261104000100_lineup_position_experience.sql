begin;

-- Only aggregate position experience is exposed, never historical lineups.
create function public.lineup_position_experience(p_call_id uuid)
returns table(player_id text, category text, appearances bigint)
language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
  select * into c from public.call_ups where id=p_call_id;
  if not found then raise exception 'Call-up not found' using errcode='22023'; end if;
  perform private.require_admin(c.club_id);
  if not private.has_lineup_premium(c.club_id) and not exists(select 1 from public.club_lineup_accesses where call_up_id=c.id and club_id=c.club_id) then
    raise exception 'Lineup access required' using errcode='42501';
  end if;
  return query
  select history.player_id,history.category,count(distinct history.call_id) from (
    select previous.id call_id,p.id::text player_id,case
      when (slot->>'id')::integer=0 then 'goalkeepers'
      when (slot->>'y')::numeric>=.65 then case
        when l.published->>'formation'<>'3-5-2' and ((slot->>'x')::numeric<=.26 or (slot->>'x')::numeric>=.74) then 'wide_backs' else 'centre_backs' end
      when (slot->>'y')::numeric<.30 then 'attackers'
      when (slot->>'x')::numeric<=.22 or (slot->>'x')::numeric>=.78 then 'wide_backs'
      else 'midfielders' end category
    from public.call_up_lineups l
    join public.call_ups previous on previous.id=l.call_up_id and previous.club_id=l.club_id
    cross join lateral jsonb_array_elements(l.published->'slots') slot
    join public.players p on p.id::text=slot->>'playerId' and p.club_id=c.club_id and p.is_active
    where l.club_id=c.club_id and l.call_up_id<>c.id and previous.starts_at<c.starts_at
      and previous.ends_at<=clock_timestamp() and previous.status<>'cancelled'
      and l.published is not null
  ) history group by history.player_id,history.category;
end;
$$;
revoke all on function public.lineup_position_experience(uuid) from public,anon;
grant execute on function public.lineup_position_experience(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
