begin;
-- Compute the public badge when searching so expiration requires no scheduled
-- directory updates. Only public directory entries are exposed.
drop function public.search_clubs(text);
create function public.search_clubs(p_query text)
returns table(club_id uuid,name text,description text,crest_path text,is_premium boolean)
language sql stable security definer set search_path='' as $$
 select d.club_id,d.name,d.description,d.crest_path,private.has_club_premium(d.club_id)
 from public.club_directory d
 where position(lower(left(btrim(coalesce(p_query,'')),80)) in lower(d.name))>0
 order by d.name limit 50;
$$;
revoke all on function public.search_clubs(text) from public,anon,authenticated;
grant execute on function public.search_clubs(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
