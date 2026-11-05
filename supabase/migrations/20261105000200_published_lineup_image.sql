begin;

-- Members may view the published poster snapshot, never the editor document.
create function public.read_published_lineup(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups; snapshot jsonb;
begin
 select * into c from public.call_ups where id=p_call_id;
 if not found or not private.is_member(c.club_id) or c.status not in ('open','closed') then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 if c.ends_at<=clock_timestamp() and not private.has_club_premium(c.club_id) then
  return jsonb_build_object('allowed',false);
 end if;
 select historical_snapshot into snapshot from public.call_up_lineups where call_up_id=c.id and published is not null;
 if snapshot is null then return jsonb_build_object('allowed',true,'snapshot',null); end if;
 -- Explicitly whitelist poster fields. Drafts, scores and private notes stay private.
 return jsonb_build_object('allowed',true,'snapshot',jsonb_build_object(
  'clubName',snapshot->'clubName','crestPath',snapshot->'crestPath',
  'lineup',snapshot->'lineup','candidates',snapshot->'candidates',
  'shirtColor',snapshot->'shirtColor','numberColor',snapshot->'numberColor',
  'goalkeeperColor',snapshot->'goalkeeperColor'
 ));
end; $$;
revoke all on function public.read_published_lineup(uuid) from public,anon;
grant execute on function public.read_published_lineup(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
