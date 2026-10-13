begin;

create function private.require_user() returns uuid language plpgsql stable set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return v_user;
end;
$$;
create function private.require_admin(p_club_id uuid) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.is_admin(p_club_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
end;
$$;

create function public.create_club(p_name text, p_description text default null, p_timezone text default 'Europe/Madrid', p_is_public boolean default false)
returns public.clubs language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_club public.clubs;
begin
  insert into public.clubs(name, description, timezone, is_public, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_timezone, p_is_public, v_user) returning * into v_club;
  insert into public.club_members(club_id, user_id, role) values (v_club.id, v_user, 'admin');
  return v_club;
end;
$$;

create function public.set_club_member(p_club_id uuid, p_user_id uuid, p_role public.club_role, p_is_active boolean)
returns public.club_members language plpgsql security definer set search_path = '' as $$
declare v_member public.club_members;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  select * into v_member from public.club_members where club_id = p_club_id and user_id = p_user_id for update;
  if not found then raise exception 'Member not found' using errcode = '22023'; end if;
  if v_member.role = 'admin' and v_member.is_active and (p_role <> 'admin' or not p_is_active)
    and (select count(*) from public.club_members where club_id = p_club_id and role = 'admin' and is_active) = 1 then
    raise exception 'Cannot remove the last active admin' using errcode = '23514';
  end if;
  update public.club_members set role = p_role, is_active = p_is_active where id = v_member.id returning * into v_member;
  return v_member;
end;
$$;

create function private.link_player(p_club_id uuid, p_player_id uuid, p_user_id uuid)
returns public.players language plpgsql security definer set search_path = '' as $$
declare v_player public.players;
begin
  if not exists (select 1 from public.club_members where club_id = p_club_id and user_id = p_user_id and is_active) then
    raise exception 'An active membership is required' using errcode = '22023';
  end if;
  select * into v_player from public.players where id = p_player_id and club_id = p_club_id for update;
  if not found then raise exception 'Player not found' using errcode = '22023'; end if;
  if v_player.user_id is not null and v_player.user_id <> p_user_id then
    raise exception 'Player already linked' using errcode = '23505';
  end if;
  update public.players set user_id = p_user_id where id = v_player.id returning * into v_player;
  update public.call_up_players s set user_id = p_user_id, updated_at = now()
  from public.call_ups c where s.call_up_id = c.id and s.club_id = p_club_id and s.source_player_id = p_player_id
    and s.user_id is null and c.status in ('draft', 'open');
  return v_player;
end;
$$;
create function public.link_player_account(p_player_id uuid, p_user_id uuid)
returns public.players language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from public.players where id = p_player_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  return private.link_player(v_club_id, p_player_id, p_user_id);
end;
$$;

create function public.request_to_join(p_club_id uuid)
returns public.join_requests language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_request public.join_requests;
begin
  if not exists (select 1 from public.clubs where id = p_club_id and is_public) then
    raise exception 'Club not available for requests' using errcode = '42501';
  end if;
  if private.is_member(p_club_id) then raise exception 'Already an active member' using errcode = '22023'; end if;
  insert into public.join_requests(club_id, user_id) values (p_club_id, v_user) returning * into v_request;
  return v_request;
end;
$$;

create function public.review_join_request(p_request_id uuid, p_approve boolean, p_player_id uuid default null)
returns public.join_requests language plpgsql security definer set search_path = '' as $$
declare v_request public.join_requests; v_club_id uuid; v_user uuid := private.require_user();
begin
  select club_id into v_club_id from public.join_requests where id = p_request_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  select * into v_request from public.join_requests where id = p_request_id for update;
  if v_request.status <> 'pending' then raise exception 'Request already resolved' using errcode = '22023'; end if;
  if p_approve then
    insert into public.club_members(club_id, user_id) values (v_request.club_id, v_request.user_id)
    on conflict (club_id, user_id) do update set is_active = true,
      role = case when club_members.is_active then club_members.role else 'player'::public.club_role end;
    if p_player_id is not null then perform private.link_player(v_club_id, p_player_id, v_request.user_id); end if;
  elsif p_player_id is not null then
    raise exception 'Cannot link a rejected request' using errcode = '22023';
  end if;
  update public.join_requests set status = case when p_approve then 'approved'::public.join_request_status else 'rejected'::public.join_request_status end,
    decided_at = now(), decided_by = v_user where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

create function public.create_call_up(p_club_id uuid, p_starts_at timestamptz, p_status public.call_up_status default 'draft')
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_call_up public.call_ups;
begin
  perform 1 from public.clubs where id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_status not in ('draft', 'open') then raise exception 'Initial status must be draft or open' using errcode = '22023'; end if;
  insert into public.call_ups(club_id, starts_at, status) values (p_club_id, p_starts_at, p_status) returning * into v_call_up;
  insert into public.call_up_players(club_id, call_up_id, source_player_id, user_id, ea_id_snapshot, jersey_number_snapshot, position_snapshot)
  select p_club_id, v_call_up.id, p.id, case when m.is_active then p.user_id end, p.ea_id, p.jersey_number, p.position
  from public.players p left join public.club_members m on m.club_id = p.club_id and m.user_id = p.user_id
  where p.club_id = p_club_id and p.is_active;
  return v_call_up;
end;
$$;

create function public.update_call_up(p_call_up_id uuid, p_starts_at timestamptz, p_status public.call_up_status)
returns public.call_ups language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid; v_call_up public.call_ups;
begin
  select club_id into v_club_id from public.call_ups where id = p_call_up_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  update public.call_ups set starts_at = p_starts_at, status = p_status where id = p_call_up_id returning * into v_call_up;
  return v_call_up;
end;
$$;

create function public.respond_to_call_up(p_call_up_player_id uuid, p_availability public.availability_status)
returns public.call_up_players language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_entry public.call_up_players; v_status public.call_up_status; v_club_id uuid;
begin
  select c.club_id into v_club_id from public.call_up_players s join public.call_ups c on c.id = s.call_up_id where s.id = p_call_up_player_id;
  perform 1 from public.clubs where id = v_club_id for update;
  select c.status into v_status from public.call_ups c join public.call_up_players s on s.call_up_id = c.id where s.id = p_call_up_player_id for update of c;
  select * into v_entry from public.call_up_players where id = p_call_up_player_id for update;
  if not found or v_entry.user_id is distinct from v_user or not private.is_member(v_entry.club_id) or v_status <> 'open' then
    raise exception 'Not authorized to respond' using errcode = '42501';
  end if;
  update public.call_up_players set availability = p_availability,
    responded_at = case when p_availability = 'unanswered' then null else now() end, updated_at = now()
  where id = v_entry.id returning * into v_entry;
  return v_entry;
end;
$$;

create function public.create_club_invitation(p_club_id uuid, p_expires_at timestamptz, p_max_uses integer default 1)
returns table(id uuid, token text, expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid;
begin
  perform 1 from public.clubs where clubs.id = p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then raise exception 'Invalid expiration' using errcode = '22023'; end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.club_invitations(club_id, token_hash, expires_at, max_uses, created_by)
  values (p_club_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_expires_at, p_max_uses, private.require_user()) returning club_invitations.id into v_id;
  return query select v_id, v_token, p_expires_at;
end;
$$;

create function public.revoke_club_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_club_id uuid;
begin
  select club_id into v_club_id from public.club_invitations where id = p_invitation_id;
  perform 1 from public.clubs where id = v_club_id for update;
  perform private.require_admin(v_club_id);
  update public.club_invitations set revoked_at = now() where id = p_invitation_id;
end;
$$;

create function public.redeem_club_invitation(p_club_id uuid, p_token text)
returns public.club_members language plpgsql security definer set search_path = '' as $$
declare v_invite public.club_invitations; v_user uuid := private.require_user(); v_member public.club_members;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invitation not valid' using errcode = '22023'; end if;
  perform 1 from public.clubs where id = p_club_id for update;
  select * into v_invite from public.club_invitations where club_id = p_club_id
    and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() or v_invite.uses >= v_invite.max_uses then
    raise exception 'Invitation not valid' using errcode = '22023';
  end if;
  if private.is_member(p_club_id) then
    select * into v_member from public.club_members where club_id = p_club_id and user_id = v_user;
    return v_member;
  end if;
  insert into public.club_members(club_id, user_id) values (p_club_id, v_user)
  on conflict (club_id, user_id) do update set is_active = true, role = 'player' returning * into v_member;
  update public.club_invitations set uses = uses + 1 where club_invitations.id = v_invite.id;
  return v_member;
end;
$$;

revoke all on function private.require_user(), private.require_admin(uuid), private.link_player(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_club(text, text, text, boolean), public.set_club_member(uuid, uuid, public.club_role, boolean),
  public.link_player_account(uuid, uuid), public.request_to_join(uuid), public.review_join_request(uuid, boolean, uuid),
  public.create_call_up(uuid, timestamptz, public.call_up_status), public.update_call_up(uuid, timestamptz, public.call_up_status), public.respond_to_call_up(uuid, public.availability_status),
  public.create_club_invitation(uuid, timestamptz, integer), public.revoke_club_invitation(uuid), public.redeem_club_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.create_club(text, text, text, boolean), public.set_club_member(uuid, uuid, public.club_role, boolean),
  public.link_player_account(uuid, uuid), public.request_to_join(uuid), public.review_join_request(uuid, boolean, uuid),
  public.create_call_up(uuid, timestamptz, public.call_up_status), public.update_call_up(uuid, timestamptz, public.call_up_status), public.respond_to_call_up(uuid, public.availability_status),
  public.create_club_invitation(uuid, timestamptz, integer), public.revoke_club_invitation(uuid), public.redeem_club_invitation(uuid, text) to authenticated;

commit;
