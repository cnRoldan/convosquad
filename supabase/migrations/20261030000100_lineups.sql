begin;
create table public.call_up_lineups (
 call_up_id uuid primary key references public.call_ups(id) on delete cascade,
 club_id uuid not null references public.clubs(id) on delete cascade,
 draft jsonb not null,
 published jsonb,
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.call_up_lineups enable row level security;
revoke all on public.call_up_lineups from public,anon,authenticated;

create function public.read_lineup(p_call_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups; l public.call_up_lineups; a boolean;
begin
 select * into c from public.call_ups where id=p_call_id;
 if not found or not private.is_member(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
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

create function public.save_lineup(p_call_id uuid,p_revision integer,p_document jsonb,p_publish boolean default false)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.call_ups; r integer; s jsonb; ids text[]; occupied integer;
begin
 select * into c from public.call_ups where id=p_call_id;
 perform private.require_admin(c.club_id);
 perform 1 from public.clubs where id=c.club_id for update;
 select * into c from public.call_ups where id=p_call_id for update;
 if not found then raise exception 'Call-up not found'; end if;
 perform private.require_admin(c.club_id);
 if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended' using errcode='42501'; end if;
 select revision into r from public.call_up_lineups where call_up_id=c.id;
 if p_publish is null or p_revision is null or coalesce(r,0)<>p_revision then raise exception 'Lineup changed by another captain' using errcode='40001'; end if;
 if p_document is null or jsonb_typeof(p_document->'slots') is distinct from 'array' or jsonb_typeof(p_document->'bench') is distinct from 'array'
 or jsonb_array_length(p_document->'slots')<>11 or octet_length(p_document::text)>100000 then raise exception 'Invalid lineup' using errcode='22023'; end if;
 if p_document->>'formation' is null or p_document->>'formation' not in ('4-3-3','4-4-2','4-2-3-1','3-5-2') then raise exception 'Invalid formation'; end if;
 if (select count(distinct (value->>'id')::integer) from jsonb_array_elements(p_document->'slots'))<>11 then raise exception 'Invalid slots'; end if;
 for s in select value from jsonb_array_elements(p_document->'slots') loop
 if jsonb_typeof(s->'id') is distinct from 'number' or jsonb_typeof(s->'x') is distinct from 'number' or jsonb_typeof(s->'y') is distinct from 'number' or not (s ? 'playerId') then raise exception 'Invalid slot'; end if;
 if (s->>'id')::integer not between 0 and 10 or (s->>'x')::numeric not between 0.08 and 0.92 or (s->>'y')::numeric not between 0.08 and 0.92 then raise exception 'Invalid position'; end if;
 if (s->>'id')::integer=0 and ((s->>'x')::numeric<>0.5 or (s->>'y')::numeric<>0.9) then raise exception 'Goalkeeper position fixed'; end if;
 end loop;
 select array_agg(id) into ids from (
 select value->>'playerId' id from jsonb_array_elements(p_document->'slots') where value->>'playerId' is not null
 union all select value from jsonb_array_elements_text(p_document->'bench')) x;
 if cardinality(ids)<>(select count(distinct id) from unnest(ids) id) then raise exception 'Duplicate player'; end if;
 if exists(select 1 from unnest(ids) as candidate(player_id) where not exists(select 1 from public.players p where p.id::text=candidate.player_id and p.club_id=c.club_id and p.is_active)
 and not exists(select 1 from public.lineup_guests g where g.id::text=candidate.player_id and g.club_id=c.club_id and (g.call_up_id=c.id or g.retained))
 and not exists(select 1 from public.club_trials t where t.id::text=candidate.player_id and t.club_id=c.club_id and t.status='active')
 and not exists(select 1 from public.call_up_trials t where t.id::text=candidate.player_id and t.call_up_id=c.id)
 and not exists(select 1 from public.call_up_aids a where a.id::text=candidate.player_id and a.call_up_id=c.id)) then raise exception 'Invalid player'; end if;
 perform private.materialize_lineup_candidates(c.id,ids);
 select count(*) into occupied from jsonb_array_elements(p_document->'slots') where value->>'playerId' is not null;
 if p_publish and occupied<>11 then raise exception 'Eleven players required'; end if;
 insert into public.call_up_lineups(call_up_id,club_id,draft,published) values(c.id,c.club_id,p_document,case when p_publish then p_document end)
 on conflict(call_up_id) do update set draft=p_document,published=case when p_publish then p_document else call_up_lineups.published end,revision=call_up_lineups.revision+1,updated_at=now()
 returning revision into r;
 return r;
end; $$;
revoke all on function public.read_lineup(uuid),public.save_lineup(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.read_lineup(uuid),public.save_lineup(uuid,integer,jsonb,boolean) to authenticated;
commit;
