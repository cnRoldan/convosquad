begin;

-- A match that has started is still active until its scheduled end. It must not
-- appear in the captains' rating list while that end is still in the future.
create or replace function public.list_rating_call_ups(p_club_id uuid) returns setof public.call_ups
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  return query select c.* from public.call_ups c where c.club_id=p_club_id and c.status in ('open','closed')
    and c.starts_at>=now()-interval '3 months' and c.starts_at<=now()
    and c.ends_at<=now() and c.evaluation_at<=now()
    order by c.starts_at desc,c.id;
end;
$$;

notify pgrst,'reload schema';
commit;
