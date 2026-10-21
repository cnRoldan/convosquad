begin;

alter table public.call_up_players add column decision_locked boolean not null default false;

-- Expose only the indicator through the existing, club-scoped snapshot policies.
-- The retained preference itself remains private to its owner.
create function private.stamp_visible_decision_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  new.decision_locked:=exists(select 1 from public.club_decision_locks l
    join public.club_members m on m.club_id=l.club_id and m.user_id=l.user_id and m.is_active
    where l.club_id=new.club_id and l.user_id=new.user_id
      and exists(select 1 from public.players p where p.club_id=l.club_id and p.user_id=l.user_id and p.is_active));
  return new;
end;
$$;
create trigger stamp_visible_decision_lock before insert or update of club_id,user_id,decision_locked
  on public.call_up_players for each row execute function private.stamp_visible_decision_lock();

create function private.sync_visible_decision_locks() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_user uuid; v_locked boolean:=tg_op<>'DELETE';
begin
  if tg_op='DELETE' then v_club:=old.club_id; v_user:=old.user_id;
  else v_club:=new.club_id; v_user:=new.user_id; end if;
  update public.call_up_players set decision_locked=v_locked
    where club_id=v_club and user_id=v_user and decision_locked is distinct from v_locked;
  return null;
end;
$$;
create trigger sync_visible_decision_locks after insert or update or delete on public.club_decision_locks
  for each row execute function private.sync_visible_decision_locks();
revoke all on function private.stamp_visible_decision_lock(),private.sync_visible_decision_locks() from public,anon,authenticated;

update public.call_up_players p set decision_locked=true
where exists(select 1 from public.club_decision_locks l where l.club_id=p.club_id and l.user_id=p.user_id);

notify pgrst,'reload schema';
commit;
