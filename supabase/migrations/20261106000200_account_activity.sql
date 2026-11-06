begin;

-- Deliberately private: club membership is not permission to read every account.
create table private.account_activity (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_active_at timestamptz not null default now()
);
revoke all on private.account_activity from public, anon, authenticated;
insert into private.account_activity(user_id) select id from public.profiles;

create function private.initialize_account_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.account_activity(user_id) values(new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.initialize_account_activity() from public, anon, authenticated;
create trigger initialize_account_activity after insert on public.profiles
  for each row execute function private.initialize_account_activity();

create function public.record_account_activity() returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user();
begin
  -- The client supplies neither an identity nor a timestamp. Token refresh and
  -- server jobs never call this endpoint; the foreground app does.
  insert into private.account_activity(user_id) values(v_user)
  on conflict(user_id) do update set last_active_at = now()
    where private.account_activity.last_active_at < now() - interval '15 minutes';
end;
$$;

create view private.account_inactivity_review as
select a.user_id, a.last_active_at,
  case
    when not exists(select 1 from public.club_members m where m.user_id=a.user_id and m.is_active)
      and not exists(select 1 from public.players p where p.user_id=a.user_id)
    then case when a.last_active_at <= now() - interval '90 days' then 'orphan_review_due'
              when a.last_active_at <= now() - interval '60 days' then 'orphan_warning_due'
              else 'active' end
    when a.last_active_at <= now() - interval '6 months' then 'member_review_due'
    else 'active'
  end as stage,
  exists(select 1 from public.club_members m
    where m.user_id=a.user_id and m.is_active and m.role='admin'
      and not exists(select 1 from public.club_members other
        where other.club_id=m.club_id and other.user_id<>m.user_id and other.is_active and other.role='admin')) as sole_captain
from private.account_activity a;
revoke all on private.account_inactivity_review from public, anon, authenticated;

create function public.list_inactive_club_members(p_club_id uuid)
returns table(user_id uuid, username text, role public.club_role, last_active_at timestamptz, has_player_card boolean, sole_captain boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query select m.user_id, p.username, m.role, a.last_active_at,
    exists(select 1 from public.players player where player.club_id=m.club_id and player.user_id=m.user_id),
    m.role='admin' and not exists(select 1 from public.club_members other
      where other.club_id=m.club_id and other.user_id<>m.user_id and other.is_active and other.role='admin')
  from public.club_members m
    join public.profiles p on p.id=m.user_id
    join private.account_activity a on a.user_id=m.user_id
  where m.club_id=p_club_id and m.is_active and a.last_active_at <= now() - interval '6 months'
  order by a.last_active_at, m.user_id;
end;
$$;

revoke all on function public.record_account_activity(), public.list_inactive_club_members(uuid) from public, anon;
grant execute on function public.record_account_activity(), public.list_inactive_club_members(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
