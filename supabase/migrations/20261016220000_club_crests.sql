begin;
alter table public.clubs add column crest_path text check(crest_path is null or crest_path=id::text||'/crest.png');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('club-crests','club-crests',false,5242880,array['image/png']);

create function private.crest_club_id(p_name text) returns uuid language sql immutable set search_path='' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/crest\.png$'
    then split_part(p_name,'/',1)::uuid else null end;
$$;
revoke all on function private.crest_club_id(text) from public,anon;
grant execute on function private.crest_club_id(text) to authenticated;
create policy crest_read_members on storage.objects for select to authenticated
  using(bucket_id='club-crests' and private.is_member(private.crest_club_id(name)));
create policy crest_insert_captains on storage.objects for insert to authenticated
  with check(bucket_id='club-crests' and private.is_admin(private.crest_club_id(name)));
create policy crest_update_captains on storage.objects for update to authenticated
  using(bucket_id='club-crests' and private.is_admin(private.crest_club_id(name)))
  with check(bucket_id='club-crests' and private.is_admin(private.crest_club_id(name)));
create policy crest_delete_captains on storage.objects for delete to authenticated
  using(bucket_id='club-crests' and private.is_admin(private.crest_club_id(name)));

create function public.set_club_crest(p_club_id uuid,p_has_crest boolean)
returns public.clubs language plpgsql security definer set search_path='' as $$
declare v_club public.clubs; v_path text:=p_club_id::text||'/crest.png';
begin
  perform private.require_admin(p_club_id);
  perform 1 from public.clubs where id=p_club_id for update;
  if p_has_crest is null then raise exception 'Invalid crest' using errcode='22023'; end if;
  if p_has_crest and not exists(select 1 from storage.objects where bucket_id='club-crests' and name=v_path) then
    raise exception 'Crest not uploaded' using errcode='22023';
  end if;
  update public.clubs set crest_path=case when p_has_crest then v_path else null end where id=p_club_id returning * into v_club;
  return v_club;
end;
$$;
revoke all on function public.set_club_crest(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_club_crest(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
