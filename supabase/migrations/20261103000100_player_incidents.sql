begin;

create table public.player_incidents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  call_up_id uuid references public.call_ups(id) on delete set null,
  call_up_player_id uuid references public.call_up_players(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null,
  match_starts_at timestamptz not null,
  match_timezone text not null,
  kind text not null check (kind in ('late','no_show','left_early','other')),
  note text not null default '' check (char_length(note)<=500),
  recorded_by uuid references public.profiles(id) on delete set null,
  captain_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '168 hours'),
  check (expires_at=created_at+interval '168 hours'),
  check (kind<>'other' or char_length(btrim(note))>0),
  unique (call_up_player_id,kind)
);
create index player_incidents_active on public.player_incidents(club_id,expires_at,player_id);
create index player_incidents_history on public.player_incidents(club_id,created_at desc,id desc);
alter table public.player_incidents enable row level security;
revoke all on public.player_incidents from public,anon,authenticated;
grant select on public.player_incidents to authenticated;
create policy player_incidents_captains on public.player_incidents for select to authenticated
  using (private.is_admin(club_id));

create function public.record_player_incident(p_call_up_id uuid,p_entry_id uuid,p_kind text,p_note text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups; p public.call_up_players; incident public.player_incidents;
  u uuid:=private.require_user(); recorded timestamptz; author text;
begin
  select * into c from public.call_ups where id=p_call_up_id;
  perform private.require_admin(c.club_id);
  -- Serializes recording and publication so a new incident cannot slip past confirmation.
  perform 1 from public.clubs where id=c.club_id for update;
  select * into c from public.call_ups where id=p_call_up_id for update;
  if not private.can_rate_call_up(c.id,clock_timestamp()) then
    raise exception 'Incident recording window is closed' using errcode='P0041';
  end if;
  select * into p from public.call_up_players where id=p_entry_id and call_up_id=c.id and club_id=c.club_id;
  if not found or p.source_player_id is null or not exists(select 1 from public.players roster where roster.id=p.source_player_id and roster.club_id=c.club_id) then
    raise exception 'Player is not in this roster' using errcode='42501';
  end if;
  if p_kind is null or p_kind not in ('late','no_show','left_early','other') or p_note is null
    or char_length(p_note)>500 or (p_kind='other' and btrim(p_note)='') then
    raise exception 'Invalid incident' using errcode='22023';
  end if;
  recorded:=clock_timestamp();
  select username into author from public.profiles where id=u;
  insert into public.player_incidents(club_id,call_up_id,call_up_player_id,player_id,player_name,
    match_starts_at,match_timezone,kind,note,recorded_by,captain_name,created_at,expires_at)
  values(c.club_id,c.id,p.id,p.source_player_id,p.ea_id_snapshot,c.starts_at,c.timezone,p_kind,btrim(p_note),
    u,author,recorded,recorded+interval '168 hours') returning * into incident;
  return to_jsonb(incident);
end;
$$;

create function public.list_player_incidents(p_club_id uuid,p_active_only boolean default true,p_call_up_id uuid default null,p_offset integer default 0)
returns setof public.player_incidents language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  if p_offset is null or p_offset<0 or p_active_only is null then raise exception 'Invalid incident filter' using errcode='22023'; end if;
  return query select i.* from public.player_incidents i where i.club_id=p_club_id
    and (not p_active_only or (i.created_at<=clock_timestamp() and i.expires_at>clock_timestamp()))
    and (p_call_up_id is null or i.call_up_id=p_call_up_id)
    order by i.created_at desc,i.id desc
    limit case when p_active_only or p_call_up_id is not null then null else 100 end offset p_offset;
end;
$$;

create function private.require_incident_acknowledgement(p_club_id uuid,p_document jsonb,p_acknowledged uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.player_incidents i where i.club_id=p_club_id
    and i.created_at<=clock_timestamp() and i.expires_at>clock_timestamp()
    and i.player_id::text in (select value->>'playerId' from jsonb_array_elements(p_document->'slots'))
    and not (i.id=any(coalesce(p_acknowledged,'{}'::uuid[])))) then
    raise exception 'Confirm active player incidents before publishing' using errcode='P0052';
  end if;
end;
$$;

alter function public.publish_lineup_draft(uuid) rename to publish_lineup_draft_before_incidents;
alter function public.publish_lineup_draft_before_incidents(uuid) set schema private;
revoke all on function private.publish_lineup_draft_before_incidents(uuid) from public,anon,authenticated,service_role;
create function public.publish_lineup_draft(p_draft_id uuid,p_acknowledged_incidents uuid[] default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts;
begin
  select * into d from public.call_up_lineup_drafts where id=p_draft_id;
  perform private.require_admin(d.club_id);
  perform 1 from public.clubs where id=d.club_id for update;
  select * into d from public.call_up_lineup_drafts where id=p_draft_id for update;
  perform private.require_incident_acknowledgement(d.club_id,d.document,p_acknowledged_incidents);
  perform private.publish_lineup_draft_before_incidents(p_draft_id);
end;
$$;

-- Older clients must not publish through the legacy path without seeing the warning.
alter function public.save_lineup(uuid,integer,jsonb,boolean) rename to save_lineup_before_incidents;
alter function public.save_lineup_before_incidents(uuid,integer,jsonb,boolean) set schema private;
revoke all on function private.save_lineup_before_incidents(uuid,integer,jsonb,boolean) from public,anon,authenticated,service_role;
create function public.save_lineup(p_call_id uuid,p_revision integer,p_document jsonb,p_publish boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
  select * into c from public.call_ups where id=p_call_id;
  perform private.require_admin(c.club_id);
  perform 1 from public.clubs where id=c.club_id for update;
  if p_publish then perform private.require_incident_acknowledgement(c.club_id,p_document,'{}'); end if;
  return private.save_lineup_before_incidents(p_call_id,p_revision,p_document,p_publish);
end;
$$;

revoke all on function private.require_incident_acknowledgement(uuid,jsonb,uuid[]) from public,anon,authenticated,service_role;
revoke all on function public.record_player_incident(uuid,uuid,text,text),public.list_player_incidents(uuid,boolean,uuid,integer),
  public.publish_lineup_draft(uuid,uuid[]),public.save_lineup(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.record_player_incident(uuid,uuid,text,text),public.list_player_incidents(uuid,boolean,uuid,integer),
  public.publish_lineup_draft(uuid,uuid[]),public.save_lineup(uuid,integer,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
