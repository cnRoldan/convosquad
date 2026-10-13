begin;

alter table public.join_requests add column club_name_snapshot text not null default 'Club solicitado';
update public.join_requests r set club_name_snapshot = c.name from public.clubs c where c.id = r.club_id and c.is_public;

create function private.can_review_profile(p_user_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.join_requests r join public.club_members m on m.club_id = r.club_id
    where r.user_id = p_user_id and r.status = 'pending' and m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin'
  );
$$;
revoke all on function private.can_review_profile(uuid) from public, anon, authenticated;
grant execute on function private.can_review_profile(uuid) to authenticated;
drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or private.shares_club(id) or private.can_review_profile(id)
);

create or replace function public.request_to_join(p_club_id uuid)
returns public.join_requests language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_request public.join_requests; v_name text;
begin
  select name into v_name from public.clubs where id = p_club_id and is_public for share;
  if not found then raise exception 'Club not available for requests' using errcode = '42501'; end if;
  if private.is_member(p_club_id) then raise exception 'Already an active member' using errcode = '22023'; end if;
  insert into public.join_requests(club_id, user_id, club_name_snapshot) values (p_club_id, v_user, v_name) returning * into v_request;
  return v_request;
end;
$$;

create function public.search_clubs(p_query text)
returns setof public.club_directory language sql stable security invoker set search_path = '' as $$
  select d.club_id, d.name, d.description from public.club_directory d
  where position(lower(left(btrim(coalesce(p_query, '')), 80)) in lower(d.name)) > 0 order by d.name limit 50;
$$;
revoke all on function public.search_clubs(text) from public, anon, authenticated;
grant execute on function public.search_clubs(text) to anon, authenticated;

DO $$
begin
  if exists (select 1 from public.players group by club_id, lower(btrim(ea_id)) having count(*) > 1) then
    raise exception 'Resolve existing EA ID duplicates before applying this migration' using errcode = '23505';
  end if;
end;
$$;
update public.players set ea_id = btrim(ea_id) where ea_id <> btrim(ea_id);
create function private.normalize_player_ea_id() returns trigger language plpgsql set search_path = '' as $$
begin
  new.ea_id := btrim(new.ea_id);
  return new;
end;
$$;
create trigger normalize_player_ea_id before insert or update of ea_id on public.players for each row execute function private.normalize_player_ea_id();
revoke all on function private.normalize_player_ea_id() from public, anon, authenticated;

create function public.import_players(p_club_id uuid, p_players jsonb)
returns setof public.players language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_player public.players;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_players is null or jsonb_typeof(p_players) <> 'array' then raise exception 'Invalid import payload' using errcode = '22023'; end if;
  if jsonb_array_length(p_players) not between 1 and 100 then raise exception 'Import requires 1 to 100 players' using errcode = '22023'; end if;
  for v_item in select value from jsonb_array_elements(p_players) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'Invalid player' using errcode = '22023'; end if;
    if exists (select 1 from jsonb_object_keys(v_item) k where k not in ('ea_id', 'jersey_number', 'position')) then
      raise exception 'Unexpected player fields' using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'ea_id') is distinct from 'string' or jsonb_typeof(v_item -> 'position') is distinct from 'string'
      or jsonb_typeof(v_item -> 'jersey_number') is distinct from 'number'
      or (v_item ->> 'jersey_number') !~ '^[1-9][0-9]?$' then
      raise exception 'Invalid player fields' using errcode = '22023';
    end if;
    insert into public.players(club_id, ea_id, jersey_number, position)
    values (p_club_id, v_item ->> 'ea_id', (v_item ->> 'jersey_number')::smallint, (v_item ->> 'position')::public.player_position)
    returning * into v_player;
    return next v_player;
  end loop;
  return;
end;
$$;
revoke all on function public.import_players(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_players(uuid, jsonb) to authenticated;

create function public.create_invitation_for_hours(p_club_id uuid, p_hours integer, p_max_uses integer default 1)
returns table(id uuid, token text, expires_at timestamptz) language plpgsql security invoker set search_path = '' as $$
begin
  if p_hours is null or p_hours not between 1 and 720 then raise exception 'Invalid lifetime' using errcode = '22023'; end if;
  return query select * from public.create_club_invitation(p_club_id, now() + p_hours * interval '1 hour', p_max_uses);
end;
$$;
revoke all on function public.create_invitation_for_hours(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.create_invitation_for_hours(uuid, integer, integer) to authenticated;

commit;
