begin;

create function private.is_member(p_club_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = p_club_id and m.user_id = (select auth.uid()) and m.is_active);
$$;
create function private.is_admin(p_club_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.club_members m where m.club_id = p_club_id and m.user_id = (select auth.uid()) and m.is_active and m.role = 'admin');
$$;
create function private.shares_club(p_user_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.club_members mine join public.club_members theirs on theirs.club_id = mine.club_id
    where mine.user_id = (select auth.uid()) and mine.is_active and theirs.user_id = p_user_id and theirs.is_active
  );
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_member(uuid), private.is_admin(uuid), private.shares_club(uuid) from public, anon;
grant execute on function private.is_member(uuid), private.is_admin(uuid), private.shares_club(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_directory enable row level security;
alter table public.club_members enable row level security;
alter table public.players enable row level security;
alter table public.call_ups enable row level security;
alter table public.call_up_players enable row level security;
alter table public.join_requests enable row level security;
alter table public.club_invitations enable row level security;

revoke all on public.profiles, public.clubs, public.club_directory, public.club_members, public.players,
  public.call_ups, public.call_up_players, public.join_requests, public.club_invitations from public, anon, authenticated;

grant select on public.profiles, public.clubs, public.club_members, public.players, public.call_ups, public.call_up_players, public.join_requests to authenticated;
grant select on public.club_directory to anon, authenticated;
grant select (id, club_id, expires_at, revoked_at, max_uses, uses, created_by, created_at) on public.club_invitations to authenticated;
grant update (username) on public.profiles to authenticated;
grant update (name, description, timezone, is_public) on public.clubs to authenticated;
grant insert (club_id, ea_id, jersey_number, position, is_active) on public.players to authenticated;
grant update (ea_id, jersey_number, position, is_active) on public.players to authenticated;
grant delete on public.players to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.shares_club(id));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy clubs_read on public.clubs for select to authenticated using (private.is_member(id));
create policy clubs_update_admin on public.clubs for update to authenticated using (private.is_admin(id)) with check (private.is_admin(id));
create policy directory_read on public.club_directory for select to anon, authenticated using (true);
create policy members_read on public.club_members for select to authenticated using (private.is_admin(club_id) or (is_active and private.is_member(club_id)));
create policy players_read on public.players for select to authenticated using (private.is_member(club_id));
create policy players_insert_admin on public.players for insert to authenticated with check (private.is_admin(club_id) and user_id is null);
create policy players_update_admin on public.players for update to authenticated using (private.is_admin(club_id)) with check (private.is_admin(club_id));
create policy players_delete_admin on public.players for delete to authenticated using (private.is_admin(club_id));
create policy call_ups_read on public.call_ups for select to authenticated using (private.is_admin(club_id) or (status = 'open' and private.is_member(club_id)));
create policy call_ups_update_admin on public.call_ups for update to authenticated using (private.is_admin(club_id)) with check (private.is_admin(club_id));
create policy call_up_players_read on public.call_up_players for select to authenticated using (
  exists (select 1 from public.call_ups c where c.id = call_up_id and c.club_id = call_up_players.club_id)
);
create policy join_requests_read on public.join_requests for select to authenticated using (user_id = (select auth.uid()) or private.is_admin(club_id));
create policy invitations_read_admin on public.club_invitations for select to authenticated using (private.is_admin(club_id));

commit;
