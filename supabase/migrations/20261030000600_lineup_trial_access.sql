begin;

-- Each row is one shared generation for a call-up.  It deliberately belongs
-- to the call-up, rather than a user, so a captain only unlocks it once for
-- the entire club.
create table public.club_lineup_accesses (
  call_up_id uuid primary key references public.call_ups(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  activated_at timestamptz not null default now(),
  activated_by uuid references public.profiles(id) on delete set null
);
create index club_lineup_accesses_club_id_idx on public.club_lineup_accesses(club_id);
alter table public.club_lineup_accesses enable row level security;
revoke all on public.club_lineup_accesses from public, anon, authenticated;

-- Payments will set this expiry.  Keeping entitlement separate from the
-- trial counter means no historic free generation has to be rewritten when
-- subscriptions go live.
create table public.club_feature_entitlements (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  lineup_premium_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.club_feature_entitlements enable row level security;
revoke all on public.club_feature_entitlements from public, anon, authenticated;

create function private.has_lineup_premium(p_club_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.club_feature_entitlements
    where club_id=p_club_id and lineup_premium_until>clock_timestamp()
  );
$$;

create function public.read_lineup_access(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups; v_activated boolean; v_premium boolean; v_used integer;
begin
  select * into c from public.call_ups where id=p_call_id;
  if not found or not private.is_member(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select exists(select 1 from public.club_lineup_accesses where call_up_id=c.id), private.has_lineup_premium(c.club_id), count(*)::integer
    into v_activated,v_premium,v_used
    from public.club_lineup_accesses where club_id=c.club_id;
  return jsonb_build_object(
    'activated',coalesce(v_activated,false),
    'premium',coalesce(v_premium,false),
    'remaining',greatest(0,6-coalesce(v_used,0)),
    'allowed',coalesce(v_activated,false) or coalesce(v_premium,false)
  );
end;
$$;

create function public.activate_lineup_access(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups; v_premium boolean; v_used integer; v_exists boolean;
begin
  select * into c from public.call_ups where id=p_call_id;
  if not found then raise exception 'Call-up not found' using errcode='22023'; end if;
  perform private.require_admin(c.club_id);
  -- Serialise activations per club. Two captains opening different calls at
  -- once cannot exceed the shared six-generation allowance.
  perform 1 from public.clubs where id=c.club_id for update;
  select * into c from public.call_ups where id=p_call_id for update;
  if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended' using errcode='42501'; end if;
  select exists(select 1 from public.club_lineup_accesses where call_up_id=c.id) into v_exists;
  v_premium:=private.has_lineup_premium(c.club_id);
  select count(*)::integer into v_used from public.club_lineup_accesses where club_id=c.club_id;
  if not v_exists and not v_premium and v_used<6 then
    insert into public.club_lineup_accesses(call_up_id,club_id,activated_by) values(c.id,c.club_id,auth.uid());
    v_exists:=true; v_used:=v_used+1;
  end if;
  return jsonb_build_object('activated',v_exists,'premium',v_premium,'remaining',greatest(0,6-v_used),'allowed',v_exists or v_premium);
end;
$$;

-- The document itself is protected too, so navigating directly to /lineup
-- cannot bypass either the trial allowance or a future subscription.
create or replace function public.read_lineup(p_call_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups; l public.call_up_lineups; a boolean;
begin
 select * into c from public.call_ups where id=p_call_id;
 if not found or not private.is_member(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if not exists(select 1 from public.club_lineup_accesses where call_up_id=c.id) and not private.has_lineup_premium(c.club_id) then
   raise exception 'Lineup access required' using errcode='42501';
 end if;
 select exists(select 1 from public.club_members where club_id=c.club_id and user_id=auth.uid() and role='admin' and is_active) into a;
 select * into l from public.call_up_lineups where call_up_id=c.id;
 if found then return jsonb_build_object('revision',l.revision,'document',case when a then l.draft else l.published end,'inherited',false); end if;
 if a then
   select x.* into l from public.call_up_lineups x join public.call_ups previous on previous.id=x.call_up_id
   where x.club_id=c.club_id and previous.starts_at<c.starts_at and x.published is not null order by previous.starts_at desc limit 1;
   return jsonb_build_object('revision',0,'document',l.published,'inherited',true);
 end if;
 return jsonb_build_object('revision',0,'document',null,'inherited',false);
end; $$;

revoke all on function private.has_lineup_premium(uuid) from public, anon, authenticated;
revoke all on function public.read_lineup_access(uuid), public.activate_lineup_access(uuid) from public, anon;
grant execute on function public.read_lineup_access(uuid), public.activate_lineup_access(uuid) to authenticated;
commit;
