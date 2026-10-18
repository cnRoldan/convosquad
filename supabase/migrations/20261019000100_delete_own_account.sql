begin;

create function public.account_deletion_blockers()
returns table(club_id uuid, club_name text) language sql stable security definer set search_path='' as $$
  select c.id, c.name from public.clubs c
  join public.club_members m on m.club_id=c.id
  where m.user_id=auth.uid() and m.is_active and m.role='admin'
    and not exists(select 1 from public.club_members other
      where other.club_id=c.id and other.user_id<>m.user_id and other.is_active and other.role='admin')
  order by c.name,c.id;
$$;

-- No target user parameter: only the authenticated account can be removed.
-- A fresh password sign-in is required, even when called outside the UI.
create function public.delete_my_account(p_confirmation text)
returns void language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := private.require_user();
  v_username text;
  v_players uuid[];
  v_trials uuid[];
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
begin
  select username into v_username from public.profiles where id=v_user;
  if not found then raise exception 'Account unavailable' using errcode='42501'; end if;
  if p_confirmation is null or lower(btrim(p_confirmation))<>lower(v_username) then
    raise exception 'Confirm your EA ID' using errcode='P4001';
  end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(v_claims->'amr','[]'::jsonb)) method
    where method->>'method'='password' and (method->>'timestamp')::numeric
      between extract(epoch from clock_timestamp()-interval '5 minutes') and extract(epoch from clock_timestamp()+interval '30 seconds')) then
    raise exception 'Recent password authentication required' using errcode='P4003';
  end if;

  -- Serialize against membership, roster, vote and captain changes.
  perform 1 from public.clubs c where c.id in (
    select club_id from public.club_members where user_id=v_user
    union select club_id from public.call_up_players where user_id=v_user
    union select club_id from public.push_events where actor_user_id=v_user
    union select id from public.clubs where created_by=v_user
  ) order by c.id for update;
  if exists(select 1 from public.account_deletion_blockers()) then
    raise exception 'Transfer captaincy or delete the club first' using errcode='P4002';
  end if;

  select coalesce(array_agg(id),'{}'::uuid[]) into v_players from public.players where user_id=v_user;
  select coalesce(array_agg(id),'{}'::uuid[]) into v_trials from public.club_trials where player_id=any(v_players);

  -- Preserve shared clubs and give their remaining captain the creator controls.
  update public.clubs c set created_by=(select m.user_id from public.club_members m
    where m.club_id=c.id and m.user_id<>v_user and m.role='admin' and m.is_active
    order by m.created_at,m.user_id limit 1) where c.created_by=v_user;

  -- Snapshots/tokens are intentionally removed before ON DELETE SET NULL loses their owner.
  delete from public.push_events where actor_user_id=v_user;
  delete from public.push_deliveries where user_id=v_user or device_id in
    (select device_id from public.push_devices where user_id=v_user);
  delete from public.call_up_players where user_id=v_user or source_player_id=any(v_players);
  delete from public.call_up_trials where source_trial_id=any(v_trials);
  delete from public.club_trials where id=any(v_trials);
  delete from public.players where id=any(v_players);
  delete from public.club_invitations where created_by=v_user;

  -- Club crests belong to the shared club: retain the object and remove uploader metadata.
  update storage.objects set owner=null,owner_id=null
    where bucket_id='club-crests' and (owner=v_user or owner_id=v_user::text);
  -- Legacy auth flows/refresh tokens have no direct user FK.
  delete from auth.refresh_tokens where user_id=v_user::text;
  delete from auth.flow_state where user_id=v_user;
  delete from auth.users where id=v_user;
  -- Auth cascades remove identities, sessions, profile, memberships, preferences,
  -- device registrations, retained decisions and notification response receipts.
end;
$$;
revoke all on function public.account_deletion_blockers(),public.delete_my_account(text) from public,anon;
grant execute on function public.account_deletion_blockers(),public.delete_my_account(text) to authenticated;
notify pgrst,'reload schema';
commit;
