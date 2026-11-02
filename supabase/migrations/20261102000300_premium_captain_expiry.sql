begin;

-- When Premium is no longer active, retain the club creator and the oldest
-- remaining captain. This also reconciles any pre-existing free clubs.
create function private.enforce_free_captain_limit(p_club_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_creator uuid; v_oldest uuid;
begin
  if private.has_club_premium(p_club_id) then return; end if;
  select created_by into v_creator from public.clubs where id=p_club_id for update;
  if v_creator is null then return; end if;
  update public.club_members set role='admin',is_active=true
    where club_id=p_club_id and user_id=v_creator;
  select user_id into v_oldest from public.club_members
    where club_id=p_club_id and user_id<>v_creator and role='admin' and is_active
    order by created_at asc limit 1;
  update public.club_members set role='player'
    where club_id=p_club_id and role='admin' and is_active and user_id<>v_creator
      and (v_oldest is null or user_id<>v_oldest);
end;
$$;

create function private.enforce_captain_limit_on_premium_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.enforce_free_captain_limit(new.club_id);
  return new;
end;
$$;

create trigger club_feature_entitlements_limit_free_captains
after insert or update of lineup_premium_until on public.club_feature_entitlements
for each row execute function private.enforce_captain_limit_on_premium_change();

select private.enforce_free_captain_limit(id) from public.clubs where not private.has_club_premium(id);

commit;
