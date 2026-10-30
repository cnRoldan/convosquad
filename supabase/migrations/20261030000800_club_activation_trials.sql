begin;

alter table public.clubs add column trial_ends_at timestamptz;
alter table public.club_feature_entitlements add column club_activated_at timestamptz;

create table public.club_trial_claims (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  first_club_id uuid references public.clubs(id) on delete set null,
  claimed_at timestamptz not null default now()
);
alter table public.club_trial_claims enable row level security;
revoke all on public.club_trial_claims from public, anon, authenticated;

-- Existing founders have already had their opportunity to try the product;
-- paid or grandfathered clubs stay unlocked through their entitlement.
insert into public.club_trial_claims(user_id,first_club_id,claimed_at)
select distinct on (created_by) created_by,id,created_at from public.clubs
where created_by is not null order by created_by,created_at
on conflict (user_id) do nothing;
update public.clubs set trial_ends_at=created_at+interval '10 days' where trial_ends_at is null;
alter table public.clubs alter column trial_ends_at set not null;

create function private.has_club_activation(p_club_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.club_feature_entitlements
    where club_id=p_club_id and (club_activated_at is not null or lineup_premium_until>clock_timestamp())
  );
$$;

create function public.read_club_activation(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
  select * into c from public.clubs where id=p_club_id;
  if not found or not private.is_member(c.id) then raise exception 'Not authorized' using errcode='42501'; end if;
  return jsonb_build_object(
    'activated',private.has_club_activation(c.id),
    'trialEndsAt',c.trial_ends_at,
    'canCreateCallUps',private.has_club_activation(c.id) or c.trial_ends_at>clock_timestamp()
  );
end;
$$;

create function private.prevent_unactivated_call_up() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.clubs;
begin
  select * into c from public.clubs where id=new.club_id;
  if not private.has_club_activation(new.club_id) and c.trial_ends_at<=clock_timestamp() then
    raise exception 'Club activation required' using errcode='P0045';
  end if;
  return new;
end;
$$;
create trigger call_ups_require_club_activation
before insert on public.call_ups
for each row execute function private.prevent_unactivated_call_up();

create or replace function private.prevent_free_club_rename() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.name is distinct from old.name and not private.has_club_activation(old.id) then
    raise exception 'Club name requires activation' using errcode='42501';
  end if;
  return new;
end;
$$;

create or replace function public.create_club(p_name text, p_description text default null, p_timezone text default 'Europe/Madrid', p_is_public boolean default false)
returns public.clubs language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_club public.clubs; v_claimed integer;
begin
  if exists(select 1 from public.clubs where lower(name)=lower(btrim(p_name))) then raise exception 'Club name already in use' using errcode='23505'; end if;
  insert into public.clubs(name, description, timezone, is_public, created_by,trial_ends_at)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_timezone, p_is_public, v_user,clock_timestamp()+interval '10 days') returning * into v_club;
  insert into public.club_trial_claims(user_id,first_club_id) values(v_user,v_club.id) on conflict do nothing;
  get diagnostics v_claimed=row_count;
  if v_claimed=0 then update public.clubs set trial_ends_at=clock_timestamp() where id=v_club.id returning * into v_club; end if;
  insert into public.club_members(club_id, user_id, role) values (v_club.id, v_user, 'admin');
  return v_club;
end;
$$;

revoke all on function private.has_club_activation(uuid), private.prevent_unactivated_call_up(), private.prevent_free_club_rename() from public, anon, authenticated;
revoke all on function public.read_club_activation(uuid) from public, anon;
grant execute on function public.read_club_activation(uuid) to authenticated;
commit;
