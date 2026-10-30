begin;

-- The entitlement created for Tu 11 is the club subscription entitlement.
-- More premium features can use this single server-side check.
create function private.has_club_premium(p_club_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.has_lineup_premium(p_club_id);
$$;

create function public.read_club_premium(p_club_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_member(p_club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  return private.has_club_premium(p_club_id);
end;
$$;

-- This protects the rule even if somebody calls the REST API directly rather
-- than using the disabled field in the app.
create function private.prevent_free_club_rename() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.name is distinct from old.name and not private.has_club_premium(old.id) then
    raise exception 'Club name requires Premium' using errcode='42501';
  end if;
  return new;
end;
$$;
create trigger clubs_require_premium_for_rename
before update of name on public.clubs
for each row execute function private.prevent_free_club_rename();

revoke all on function private.has_club_premium(uuid), private.prevent_free_club_rename() from public, anon, authenticated;
revoke all on function public.read_club_premium(uuid) from public, anon;
grant execute on function public.read_club_premium(uuid) to authenticated;
commit;
