begin;
alter table public.clubs add column ratings_visibility text not null default 'captains' check(ratings_visibility in ('captains','self','members'));
alter table public.call_ups add column evaluation_at timestamptz;
alter table public.call_ups add constraint evaluation_after_start check(evaluation_at is null or evaluation_at>=starts_at);
create index call_ups_evaluation_due on public.call_ups(evaluation_at,club_id) where status in ('open','closed') and evaluation_at is not null;
alter table public.call_up_players add constraint rated_player_scope unique(club_id,call_up_id,id);

create table public.player_ratings (
  call_up_player_id uuid primary key,
  club_id uuid not null,
  call_up_id uuid not null,
  player_id uuid not null,
  player_name text not null,
  score smallint check(score between 0 and 10),
  not_selected boolean not null default false,
  rated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  check((score is null and not_selected) or (score is not null and not not_selected)),
  foreign key(club_id,call_up_id,call_up_player_id) references public.call_up_players(club_id,call_up_id,id) on delete cascade
);
create index player_ratings_history on public.player_ratings(club_id,player_id,call_up_id);
create index player_ratings_call on public.player_ratings(call_up_id);
alter table public.player_ratings enable row level security;
revoke all on public.player_ratings from public,anon,authenticated;
grant select on public.player_ratings to authenticated;
create function private.can_read_player_rating(p_club_id uuid,p_entry_id uuid,p_player_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_member(p_club_id) and exists(
    select 1 from public.call_up_players p join public.call_ups c on c.id=p.call_up_id and c.club_id=p.club_id
      join public.clubs club on club.id=c.club_id
    where p.id=p_entry_id and p.club_id=p_club_id and c.status in ('open','closed')
      and c.starts_at>=now()-interval '3 months' and c.starts_at<=now() and c.evaluation_at<=now()
      and (private.is_admin(p_club_id) or club.ratings_visibility='members' or (club.ratings_visibility='self' and
        (p.user_id=auth.uid() or (p.user_id is null and exists(select 1 from public.players own
          where own.id=p_player_id and own.club_id=p_club_id and own.user_id=auth.uid() and own.is_active)))))
  );
$$;
revoke all on function private.can_read_player_rating(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_read_player_rating(uuid,uuid,uuid) to authenticated;
create policy visible_recent_ratings on public.player_ratings for select to authenticated
  using(private.can_read_player_rating(club_id,call_up_player_id,player_id));

create function public.set_rating_visibility(p_club_id uuid,p_visibility text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.clubs where id=p_club_id for update;
  perform private.require_admin(p_club_id);
  if p_visibility is null or p_visibility not in ('captains','self','members') then raise exception 'Invalid visibility' using errcode='22023'; end if;
  update public.clubs set ratings_visibility=p_visibility where id=p_club_id;
end;
$$;
revoke all on function public.set_rating_visibility(uuid,text) from public,anon,authenticated;
grant execute on function public.set_rating_visibility(uuid,text) to authenticated;

create function public.create_call_up_with_evaluation(p_club_id uuid,p_starts_at timestamptz,
  p_last_notice_at timestamptz default null,p_status public.call_up_status default 'draft',p_closes_at timestamptz default null,p_evaluation_at timestamptz default null)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_call public.call_ups;
begin
  select * into v_call from public.create_call_up_with_schedule(p_club_id,p_starts_at,p_last_notice_at,p_status,p_closes_at);
  update public.call_ups set evaluation_at=p_evaluation_at where id=v_call.id returning * into v_call;
  return v_call;
end;
$$;
create function public.update_call_up_with_evaluation(p_call_up_id uuid,p_starts_at timestamptz,p_status public.call_up_status,
  p_last_notice_at timestamptz default null,p_closes_at timestamptz default null,p_evaluation_at timestamptz default null)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  update public.call_ups set evaluation_at=null where id=p_call_up_id;
  select * into v_call from public.update_call_up_with_schedule(p_call_up_id,p_starts_at,p_status,p_last_notice_at,p_closes_at);
  update public.call_ups set evaluation_at=p_evaluation_at where id=v_call.id returning * into v_call;
  return v_call;
end;
$$;

create function public.save_player_ratings(p_call_up_id uuid,p_ratings jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=private.require_user(); v_club uuid; v_call public.call_ups; v_entry public.call_up_players;
  v_item jsonb; v_id uuid; v_ids uuid[]:='{}'; v_current public.player_ratings; v_expected timestamptz;
  v_score smallint; v_not_selected boolean; v_clear boolean; v_count integer:=0;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform 1 from public.clubs where id=v_club for update;
  perform private.require_admin(v_club);
  select * into v_call from public.call_ups where id=p_call_up_id and club_id=v_club for update;
  if not found or v_call.status not in ('open','closed') or v_call.starts_at<clock_timestamp()-interval '3 months'
    or v_call.starts_at>clock_timestamp() or v_call.evaluation_at is null or v_call.evaluation_at>clock_timestamp() then
    raise exception 'Rating is not available' using errcode='P0041';
  end if;
  if p_ratings is null or jsonb_typeof(p_ratings)<>'array' then raise exception 'Invalid ratings' using errcode='22023'; end if;
  if jsonb_array_length(p_ratings) not between 1 and 200 then raise exception 'Invalid ratings count' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_ratings) loop
    if jsonb_typeof(v_item)<>'object' or not (v_item ? 'expected_updated_at')
      or exists(select 1 from jsonb_object_keys(v_item) k where k not in ('entry_id','score','not_selected','clear','expected_updated_at')) then
      raise exception 'Invalid rating entry' using errcode='22023';
    end if;
    v_id:=(v_item->>'entry_id')::uuid;
    if v_id is null or v_id=any(v_ids) then raise exception 'Duplicate or missing entry' using errcode='22023'; end if;
    v_ids:=array_append(v_ids,v_id);
    select * into v_entry from public.call_up_players where id=v_id and call_up_id=v_call.id and club_id=v_club;
    if not found then raise exception 'Player is not in this call-up' using errcode='42501'; end if;
    v_current:=null;
    select * into v_current from public.player_ratings where call_up_player_id=v_id for update;
    v_expected:=(v_item->>'expected_updated_at')::timestamptz;
    if v_current.updated_at is distinct from v_expected then raise exception 'Ratings changed; reload before saving' using errcode='40001'; end if;
    v_clear:=coalesce((v_item->>'clear')::boolean,false);
    v_not_selected:=coalesce((v_item->>'not_selected')::boolean,false);
    if v_item->>'score' is not null and (v_item->>'score') !~ '^(10|[0-9])$' then raise exception 'Score must be 0 to 10' using errcode='22023'; end if;
    v_score:=(v_item->>'score')::smallint;
    if v_clear then
      if v_score is not null or v_not_selected then raise exception 'Ambiguous rating' using errcode='22023'; end if;
      delete from public.player_ratings where call_up_player_id=v_id;
    else
      if (v_score is null and not v_not_selected) or (v_score is not null and v_not_selected) then raise exception 'Choose a score or not selected' using errcode='22023'; end if;
      insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score,not_selected,rated_by)
      values(v_id,v_club,v_call.id,coalesce(v_entry.source_player_id,v_entry.id),v_entry.ea_id_snapshot,v_score,v_not_selected,v_user)
      on conflict(call_up_player_id) do update set score=excluded.score,not_selected=excluded.not_selected,rated_by=v_user,
        player_name=excluded.player_name,updated_at=clock_timestamp();
    end if;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

create function public.list_rating_call_ups(p_club_id uuid) returns setof public.call_ups
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_admin(p_club_id);
  return query select c.* from public.call_ups c where c.club_id=p_club_id and c.status in ('open','closed')
    and c.starts_at>=now()-interval '3 months' and c.starts_at<=now() and c.evaluation_at is not null order by c.starts_at desc,c.id;
end;
$$;
create function public.get_player_performance(p_club_id uuid,p_period text default '3m')
returns table(player_id uuid,player_name text,average_score numeric,rated_matches integer,not_selected_matches integer,last_match_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_cutoff timestamptz;
begin
  if not private.is_member(p_club_id) or not (private.is_admin(p_club_id) or exists(select 1 from public.clubs c where c.id=p_club_id and c.ratings_visibility in ('self','members'))) then raise exception 'Not authorized to read ratings' using errcode='42501'; end if;
  v_cutoff:=case p_period when '7d' then now()-interval '7 days' when '1m' then now()-interval '1 month' when '3m' then now()-interval '3 months' else null end;
  if v_cutoff is null then raise exception 'Invalid period' using errcode='22023'; end if;
  return query select r.player_id,(array_agg(r.player_name order by c.starts_at desc,r.updated_at desc))[1],round(avg(r.score),2),
      count(r.score)::integer,(count(*) filter(where r.not_selected))::integer,max(c.starts_at)
    from public.player_ratings r join public.call_ups c on c.id=r.call_up_id and c.club_id=r.club_id
    where r.club_id=p_club_id and private.can_read_player_rating(r.club_id,r.call_up_player_id,r.player_id) and c.starts_at>=v_cutoff and c.starts_at<=now() and c.status in ('open','closed') and c.evaluation_at<=now()
    group by r.player_id order by avg(r.score) desc nulls last,count(r.score) desc,lower((array_agg(r.player_name order by c.starts_at desc,r.updated_at desc))[1]);
end;
$$;
create function public.get_player_rating_history(p_club_id uuid,p_player_id uuid)
returns table(call_up_id uuid,starts_at timestamptz,timezone text,score smallint,not_selected boolean,updated_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if not private.is_member(p_club_id) or not (private.is_admin(p_club_id) or exists(select 1 from public.clubs c where c.id=p_club_id and c.ratings_visibility in ('self','members'))) then raise exception 'Not authorized to read ratings' using errcode='42501'; end if;
  return query select c.id,c.starts_at,c.timezone,r.score,r.not_selected,r.updated_at
    from public.player_ratings r join public.call_ups c on c.id=r.call_up_id and c.club_id=r.club_id
    where r.club_id=p_club_id and private.can_read_player_rating(r.club_id,r.call_up_player_id,r.player_id) and r.player_id=p_player_id and c.starts_at>=now()-interval '3 months'
      and c.starts_at<=now() and c.status in ('open','closed') and c.evaluation_at<=now()
    order by c.starts_at desc,c.id;
end;
$$;
revoke all on function public.create_call_up_with_evaluation(uuid,timestamptz,timestamptz,public.call_up_status,timestamptz,timestamptz),
 public.update_call_up_with_evaluation(uuid,timestamptz,public.call_up_status,timestamptz,timestamptz,timestamptz),public.save_player_ratings(uuid,jsonb),
 public.list_rating_call_ups(uuid),public.get_player_performance(uuid,text),public.get_player_rating_history(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_call_up_with_evaluation(uuid,timestamptz,timestamptz,public.call_up_status,timestamptz,timestamptz),
 public.update_call_up_with_evaluation(uuid,timestamptz,public.call_up_status,timestamptz,timestamptz,timestamptz),public.save_player_ratings(uuid,jsonb),
 public.list_rating_call_ups(uuid),public.get_player_performance(uuid,text),public.get_player_rating_history(uuid,uuid) to authenticated;

create function private.purge_expired_player_ratings() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  delete from public.player_ratings r using public.call_ups c where c.id=r.call_up_id and c.club_id=r.club_id and c.starts_at<clock_timestamp()-interval '3 months';
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function private.purge_expired_player_ratings() from public,anon,authenticated;
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute $job$select cron.schedule('convosquad-purge-player-ratings','15 3 * * *','select private.purge_expired_player_ratings()')$job$;
  end if;
end; $$;
notify pgrst,'reload schema';
commit;
