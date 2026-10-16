begin;
alter table public.profiles add column preferred_language text check(preferred_language in ('es','en','de','fr'));
create function public.set_preferred_language(p_language text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_language is null or p_language not in ('es','en','de','fr') then raise exception 'Invalid language' using errcode='22023'; end if;
  update public.profiles set preferred_language=p_language where id=private.require_user();
end;
$$;
revoke all on function public.set_preferred_language(text) from public,anon,authenticated;
grant execute on function public.set_preferred_language(text) to authenticated;
notify pgrst,'reload schema';
commit;
