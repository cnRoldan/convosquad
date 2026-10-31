begin;
create table public.call_up_lineup_drafts (
 id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
 call_up_id uuid not null references public.call_ups(id) on delete cascade, ordinal integer not null,
 title text not null check(char_length(btrim(title)) between 1 and 80), document jsonb not null,
 revision integer not null default 1, created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
 submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(call_up_id,ordinal)
);
create index call_up_lineup_drafts_call_idx on public.call_up_lineup_drafts(call_up_id,ordinal);
alter table public.call_up_lineup_drafts enable row level security; revoke all on public.call_up_lineup_drafts from public,anon,authenticated;
create table public.call_up_lineup_draft_votes (
 draft_id uuid not null references public.call_up_lineup_drafts(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
 approved boolean not null, updated_at timestamptz not null default now(), primary key(draft_id,user_id)
);
alter table public.call_up_lineup_draft_votes enable row level security; revoke all on public.call_up_lineup_draft_votes from public,anon,authenticated;

create function private.validate_lineup_draft(p_call_id uuid,p_document jsonb,p_require_eleven boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare c public.call_ups; s jsonb; occupied integer;
begin
 select * into c from public.call_ups where id=p_call_id;
 if not found then raise exception 'Call-up not found' using errcode='22023'; end if;
 if p_document is null or jsonb_typeof(p_document->'slots') is distinct from 'array' or jsonb_typeof(p_document->'bench') is distinct from 'array' or jsonb_array_length(p_document->'slots')<>11 or octet_length(p_document::text)>100000 then raise exception 'Invalid lineup' using errcode='22023'; end if;
 if p_document->>'formation' not in ('4-3-3','4-4-2','4-2-3-1','3-5-2') then raise exception 'Invalid formation' using errcode='22023'; end if;
 for s in select value from jsonb_array_elements(p_document->'slots') loop
  if jsonb_typeof(s->'id') is distinct from 'number' or jsonb_typeof(s->'x') is distinct from 'number' or jsonb_typeof(s->'y') is distinct from 'number' or not(s?'playerId') then raise exception 'Invalid slot' using errcode='22023'; end if;
  if (s->>'id')::integer not between 0 and 10 or (s->>'x')::numeric not between .08 and .92 or (s->>'y')::numeric not between .08 and .92 then raise exception 'Invalid position' using errcode='22023'; end if;
 end loop;
 if (select count(distinct(value->>'id')) from jsonb_array_elements(p_document->'slots'))<>11 then raise exception 'Invalid slots' using errcode='22023'; end if;
 select count(*) into occupied from jsonb_array_elements(p_document->'slots') where value->>'playerId' is not null;
 if p_require_eleven and occupied<>11 then raise exception 'Eleven players required' using errcode='22023'; end if;
end; $$;

create function public.list_lineup_drafts(p_call_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where id=p_call_id; if not found or not private.is_admin(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'ordinal',d.ordinal,'title',d.title,'document',d.document,'revision',d.revision,'submittedAt',d.submitted_at,'createdBy',creator.username,'updatedBy',updater.username,'updatedAt',d.updated_at,'upVotes',(select count(*) from public.call_up_lineup_draft_votes v where v.draft_id=d.id and v.approved),'downVotes',(select count(*) from public.call_up_lineup_draft_votes v where v.draft_id=d.id and not v.approved),'myVote',(select v.approved from public.call_up_lineup_draft_votes v where v.draft_id=d.id and v.user_id=auth.uid())) order by d.ordinal) from public.call_up_lineup_drafts d join public.profiles creator on creator.id=d.created_by join public.profiles updater on updater.id=d.updated_by where d.call_up_id=c.id),'[]'::jsonb);
end; $$;

create function public.save_lineup_draft(p_call_id uuid,p_draft_id uuid,p_revision integer,p_title text,p_document jsonb,p_submit boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups; d public.call_up_lineup_drafts; n integer; u uuid:=private.require_user();
begin
 select * into c from public.call_ups where id=p_call_id; perform private.require_admin(c.club_id); perform 1 from public.clubs where id=c.club_id for update;
 if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then raise exception 'Invalid draft title' using errcode='22023'; end if;
 perform private.validate_lineup_draft(c.id,p_document,false);
 if p_draft_id is null then
  select coalesce(max(ordinal),0)+1 into n from public.call_up_lineup_drafts where call_up_id=c.id;
  insert into public.call_up_lineup_drafts(club_id,call_up_id,ordinal,title,document,created_by,updated_by,submitted_at) values(c.club_id,c.id,n,btrim(p_title),p_document,u,u,case when p_submit then now() end) returning * into d;
 else
  select * into d from public.call_up_lineup_drafts where id=p_draft_id and call_up_id=c.id for update;
  if not found or d.revision<>p_revision then raise exception 'Draft changed by another captain' using errcode='40001'; end if;
  update public.call_up_lineup_drafts set title=btrim(p_title),document=p_document,revision=revision+1,updated_by=u,updated_at=now(),submitted_at=case when p_submit then now() else submitted_at end where id=d.id returning * into d;
  delete from public.call_up_lineup_draft_votes where draft_id=d.id;
 end if;
 return jsonb_build_object('id',d.id,'ordinal',d.ordinal,'title',d.title,'document',d.document,'revision',d.revision,'submittedAt',d.submitted_at);
end; $$;
create function public.vote_lineup_draft(p_draft_id uuid,p_approved boolean) returns void language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts;
begin select * into d from public.call_up_lineup_drafts where id=p_draft_id; perform private.require_admin(d.club_id); if d.submitted_at is null or p_approved is null then raise exception 'Draft is not ready for review' using errcode='22023'; end if; insert into public.call_up_lineup_draft_votes(draft_id,user_id,approved) values(d.id,auth.uid(),p_approved) on conflict(draft_id,user_id) do update set approved=excluded.approved,updated_at=now(); end; $$;
create function public.publish_lineup_draft(p_draft_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts; c public.call_ups;
begin select * into d from public.call_up_lineup_drafts where id=p_draft_id; select * into c from public.call_ups where id=d.call_up_id; perform private.require_admin(c.club_id); perform private.validate_lineup_draft(c.id,d.document,true); insert into public.call_up_lineups(call_up_id,club_id,draft,published) values(c.id,c.club_id,d.document,d.document) on conflict(call_up_id) do update set draft=excluded.draft,published=excluded.published,revision=call_up_lineups.revision+1,updated_at=now(); end; $$;
revoke all on function private.validate_lineup_draft(uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.list_lineup_drafts(uuid),public.save_lineup_draft(uuid,uuid,integer,text,jsonb,boolean),public.vote_lineup_draft(uuid,boolean),public.publish_lineup_draft(uuid) from public,anon;
grant execute on function public.list_lineup_drafts(uuid),public.save_lineup_draft(uuid,uuid,integer,text,jsonb,boolean),public.vote_lineup_draft(uuid,boolean),public.publish_lineup_draft(uuid) to authenticated;
commit;
