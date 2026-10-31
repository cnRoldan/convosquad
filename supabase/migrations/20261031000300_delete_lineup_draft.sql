begin;
create function public.delete_lineup_draft(p_draft_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts;
begin
  select * into d from public.call_up_lineup_drafts where id=p_draft_id for update;
  if not found then raise exception 'Draft not found' using errcode='22023'; end if;
  perform private.require_admin(d.club_id);
  delete from public.call_up_lineup_drafts where id=d.id;
end;
$$;
revoke all on function public.delete_lineup_draft(uuid) from public,anon;
grant execute on function public.delete_lineup_draft(uuid) to authenticated;
commit;
