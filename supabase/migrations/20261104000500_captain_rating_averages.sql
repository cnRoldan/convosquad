begin;

-- Preserve the last known legacy vote; overwritten votes cannot be recovered.
create table private.captain_player_ratings (
 id uuid primary key default gen_random_uuid(),
 call_up_player_id uuid not null references public.call_up_players(id) on delete cascade,
 rated_by uuid references public.profiles(id) on delete set null,
 score smallint check(score between 0 and 10),
 not_selected boolean not null default false,
 updated_at timestamptz not null default clock_timestamp(),
 unique(call_up_player_id,rated_by),
 check((score is null and not_selected) or (score is not null and not not_selected))
);
revoke all on private.captain_player_ratings from public,anon,authenticated,service_role;
insert into private.captain_player_ratings(call_up_player_id,rated_by,score,not_selected,updated_at)
select call_up_player_id,rated_by,score,not_selected,updated_at from public.player_ratings;

-- Existing readers and performance summaries continue to see one row per match.
alter table public.player_ratings alter column score type numeric(4,2);
drop function public.get_player_rating_history(uuid,uuid);
create function public.get_player_rating_history(p_club_id uuid,p_player_id uuid)
returns table(call_up_id uuid,starts_at timestamptz,timezone text,score numeric,not_selected boolean,updated_at timestamptz)
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
revoke all on function public.get_player_rating_history(uuid,uuid) from public,anon;
grant execute on function public.get_player_rating_history(uuid,uuid) to authenticated;

alter function public.save_player_ratings(uuid,jsonb) rename to save_player_ratings_before_captain_averages;
alter function public.save_player_ratings_before_captain_averages(uuid,jsonb) set schema private;
revoke all on function private.save_player_ratings_before_captain_averages(uuid,jsonb) from public,anon,authenticated,service_role;

create function private.save_captain_player_ratings(p_call_up_id uuid,p_ratings jsonb,p_personal boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare caller uuid:=private.require_user(); club uuid; item jsonb; entry uuid; own_updated timestamptz; shared_updated timestamptz;
 translated jsonb:='[]'; count_saved integer; player public.call_up_players;
begin
 select club_id into club from public.call_ups where id=p_call_up_id;
 perform 1 from public.clubs where id=club for update;
 perform private.require_admin(club);
 if p_ratings is null or jsonb_typeof(p_ratings)<>'array' then raise exception 'Invalid ratings' using errcode='22023'; end if;
 if p_personal then
  for item in select value from jsonb_array_elements(p_ratings) loop
   entry:=(item->>'entry_id')::uuid;
   select updated_at into own_updated from private.captain_player_ratings where call_up_player_id=entry and rated_by=caller;
   if own_updated is distinct from (item->>'expected_updated_at')::timestamptz then raise exception 'Your rating changed; reload' using errcode='40001'; end if;
   select updated_at into shared_updated from public.player_ratings where call_up_player_id=entry;
   -- The original function retains payload validation, deadline checks and reminders.
   translated:=translated||jsonb_build_array(case when item ? 'expected_updated_at' then item||jsonb_build_object('expected_updated_at',shared_updated) else item end);
  end loop;
 else translated:=p_ratings;
 end if;
 count_saved:=private.save_player_ratings_before_captain_averages(p_call_up_id,translated);
 for item in select value from jsonb_array_elements(p_ratings) loop
  entry:=(item->>'entry_id')::uuid;
  if coalesce((item->>'clear')::boolean,false) then
   delete from private.captain_player_ratings where call_up_player_id=entry and rated_by=caller;
  else
   insert into private.captain_player_ratings(call_up_player_id,rated_by,score,not_selected)
   values(entry,caller,(item->>'score')::smallint,coalesce((item->>'not_selected')::boolean,false))
   on conflict(call_up_player_id,rated_by) do update set score=excluded.score,not_selected=excluded.not_selected,updated_at=clock_timestamp();
  end if;
  select * into player from public.call_up_players where id=entry;
  if exists(select 1 from private.captain_player_ratings where call_up_player_id=entry) then
   insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score,not_selected,rated_by)
   select entry,player.club_id,player.call_up_id,coalesce(player.source_player_id,player.id),player.ea_id_snapshot,
    round(avg(score),2),count(score)=0,caller from private.captain_player_ratings where call_up_player_id=entry
   on conflict(call_up_player_id) do update set score=excluded.score,not_selected=excluded.not_selected,rated_by=caller,updated_at=clock_timestamp();
  else delete from public.player_ratings where call_up_player_id=entry;
  end if;
 end loop;
 return count_saved;
end; $$;
revoke all on function private.save_captain_player_ratings(uuid,jsonb,boolean) from public,anon,authenticated,service_role;

-- Legacy clients keep their shared timestamp contract. Clearing removes only their vote.
create function public.save_player_ratings(p_call_up_id uuid,p_ratings jsonb) returns integer
language sql security definer set search_path='' as $$ select private.save_captain_player_ratings(p_call_up_id,p_ratings,false); $$;
create function public.save_my_player_ratings(p_call_up_id uuid,p_ratings jsonb) returns integer
language sql security definer set search_path='' as $$ select private.save_captain_player_ratings(p_call_up_id,p_ratings,true); $$;

create function public.read_my_player_ratings(p_call_up_id uuid) returns setof public.player_ratings
language plpgsql security definer set search_path='' as $$
declare club uuid;
begin
 select club_id into club from public.call_ups where id=p_call_up_id;
 perform private.require_admin(club);
 return query select r.call_up_player_id,r.club_id,r.call_up_id,r.player_id,r.player_name,v.score::numeric(4,2),v.not_selected,v.rated_by,v.updated_at
 from public.player_ratings r join private.captain_player_ratings v on v.call_up_player_id=r.call_up_player_id and v.rated_by=auth.uid()
 where r.call_up_id=p_call_up_id and private.can_read_player_rating(r.club_id,r.call_up_player_id,r.player_id);
end; $$;

create function public.read_call_up_rating_averages(p_call_up_id uuid)
returns table(call_up_player_id uuid,average_score numeric,rating_count integer)
language plpgsql security definer set search_path='' as $$
declare club uuid;
begin
 select club_id into club from public.call_ups where id=p_call_up_id;
 perform private.require_admin(club);
 return query select r.call_up_player_id,r.score,count(v.score)::integer
 from public.player_ratings r join private.captain_player_ratings v on v.call_up_player_id=r.call_up_player_id
 where r.call_up_id=p_call_up_id and private.can_read_player_rating(r.club_id,r.call_up_player_id,r.player_id)
 group by r.call_up_player_id;
end; $$;
revoke all on function public.save_player_ratings(uuid,jsonb),public.save_my_player_ratings(uuid,jsonb),public.read_my_player_ratings(uuid),public.read_call_up_rating_averages(uuid) from public,anon;
grant execute on function public.save_player_ratings(uuid,jsonb),public.save_my_player_ratings(uuid,jsonb),public.read_my_player_ratings(uuid),public.read_call_up_rating_averages(uuid) to authenticated;

create or replace function private.purge_expired_player_ratings() returns integer
language plpgsql security definer set search_path='' as $$
declare count_deleted integer;
begin
 delete from private.captain_player_ratings v using public.call_up_players p,public.call_ups c
 where v.call_up_player_id=p.id and p.call_up_id=c.id and c.starts_at<clock_timestamp()-interval '3 months';
 delete from public.player_ratings r using public.call_ups c where c.id=r.call_up_id and c.club_id=r.club_id and c.starts_at<clock_timestamp()-interval '3 months';
 get diagnostics count_deleted=row_count;
 return count_deleted;
end; $$;
notify pgrst,'reload schema';
commit;
