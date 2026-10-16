begin;

create or replace function public.list_call_up_history(p_club_id uuid)
returns setof public.call_ups language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query select c.* from public.call_ups c where c.club_id = p_club_id
    and c.local_date < (now() at time zone c.timezone)::date
    order by c.starts_at desc, c.id desc limit 10;
end;
$$;
revoke all on function public.list_call_up_history(uuid) from public, anon, authenticated;
grant execute on function public.list_call_up_history(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
