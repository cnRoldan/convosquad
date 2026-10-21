begin;

alter table public.club_directory add column crest_path text;

update public.club_directory directory
set crest_path = club.crest_path
from public.clubs club
where club.id = directory.club_id;

create or replace function private.sync_club_directory()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public then
    insert into public.club_directory(club_id, name, description, crest_path)
    values (new.id, new.name, new.description, new.crest_path)
    on conflict (club_id) do update set
      name = excluded.name,
      description = excluded.description,
      crest_path = excluded.crest_path;
  else
    delete from public.club_directory where club_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger sync_club_directory on public.clubs;
create trigger sync_club_directory after insert or update of name, description, is_public, crest_path
on public.clubs for each row execute function private.sync_club_directory();

create or replace function public.search_clubs(p_query text)
returns setof public.club_directory language sql stable security invoker set search_path = '' as $$
  select directory.club_id, directory.name, directory.description, directory.crest_path
  from public.club_directory directory
  where position(lower(left(btrim(coalesce(p_query, '')), 80)) in lower(directory.name)) > 0
  order by directory.name limit 50;
$$;
revoke all on function public.search_clubs(text) from public, anon, authenticated;
grant execute on function public.search_clubs(text) to anon, authenticated;

create policy crest_read_public_directory on storage.objects for select to authenticated
  using (
    bucket_id = 'club-crests'
    and exists (
      select 1 from public.club_directory directory
      where directory.crest_path = storage.objects.name
    )
  );

notify pgrst, 'reload schema';
commit;
