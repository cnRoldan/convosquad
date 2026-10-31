begin;
alter table public.call_up_lineup_drafts add column last_suggested_changes integer not null default 0 check(last_suggested_changes>=0 and last_suggested_changes<=100),
  add column last_suggested_by uuid references public.profiles(id), add column last_suggested_at timestamptz;

create or replace function public.list_lineup_drafts(p_call_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where id=p_call_id; if not found or not private.is_admin(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'ordinal',d.ordinal,'title',d.title,'document',d.document,'revision',d.revision,'submittedAt',d.submitted_at,'createdBy',creator.username,'updatedBy',updater.username,'updatedAt',d.updated_at,'upVotes',(select count(*) from public.call_up_lineup_draft_votes v where v.draft_id=d.id and v.approved),'downVotes',(select count(*) from public.call_up_lineup_draft_votes v where v.draft_id=d.id and not v.approved),'myVote',(select v.approved from public.call_up_lineup_draft_votes v where v.draft_id=d.id and v.user_id=auth.uid()),'published',l.published_draft_id=d.id,'suggestedChanges',d.last_suggested_changes,'suggestedBy',suggester.username) order by d.ordinal) from public.call_up_lineup_drafts d join public.profiles creator on creator.id=d.created_by join public.profiles updater on updater.id=d.updated_by left join public.profiles suggester on suggester.id=d.last_suggested_by left join public.call_up_lineups l on l.call_up_id=d.call_up_id where d.call_up_id=c.id),'[]'::jsonb);
end; $$;

drop function public.save_lineup_draft(uuid,uuid,integer,text,jsonb,boolean);
create function public.save_lineup_draft(p_call_id uuid,p_draft_id uuid,p_revision integer,p_title text,p_document jsonb,p_submit boolean default false,p_suggested_changes integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups; d public.call_up_lineup_drafts; n integer; u uuid:=private.require_user(); was_submitted boolean:=false;
begin
 select * into c from public.call_ups where id=p_call_id; perform private.require_admin(c.club_id); perform 1 from public.clubs where id=c.club_id for update;
 if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 80 then raise exception 'Invalid draft title' using errcode='22023'; end if;
 if p_suggested_changes is null or p_suggested_changes not between 0 and 100 then raise exception 'Invalid suggested changes' using errcode='22023'; end if;
 perform private.validate_lineup_draft(c.id,p_document,false);
 if p_draft_id is null then
  if exists(select 1 from public.call_up_lineup_drafts x where x.call_up_id=c.id and lower(x.title)=lower(btrim(p_title))) then raise exception 'Draft title already exists' using errcode='23505'; end if;
  select coalesce(max(ordinal),0)+1 into n from public.call_up_lineup_drafts where call_up_id=c.id;
  insert into public.call_up_lineup_drafts(club_id,call_up_id,ordinal,title,document,created_by,updated_by,submitted_at) values(c.club_id,c.id,n,btrim(p_title),p_document,u,u,case when p_submit then now() end) returning * into d;
 else
  select * into d from public.call_up_lineup_drafts where id=p_draft_id and call_up_id=c.id for update;
  if not found or d.revision<>p_revision then raise exception 'Draft changed by another captain' using errcode='40001'; end if;
  was_submitted:=d.submitted_at is not null;
  update public.call_up_lineup_drafts set title=btrim(p_title),document=p_document,revision=revision+1,updated_by=u,updated_at=now(),submitted_at=case when p_submit then now() else submitted_at end,
   last_suggested_changes=case when p_submit and was_submitted then p_suggested_changes else last_suggested_changes end,
   last_suggested_by=case when p_submit and was_submitted then u else last_suggested_by end,
   last_suggested_at=case when p_submit and was_submitted then now() else last_suggested_at end where id=d.id returning * into d;
  delete from public.call_up_lineup_draft_votes where draft_id=d.id;
 end if;
 if p_submit then perform private.enqueue_lineup_push(case when was_submitted then 'lineup_suggestion' else 'lineup_review' end,d,u); end if;
 return jsonb_build_object('id',d.id,'ordinal',d.ordinal,'title',d.title,'document',d.document,'revision',d.revision,'submittedAt',d.submitted_at);
end; $$;
revoke all on function public.save_lineup_draft(uuid,uuid,integer,text,jsonb,boolean,integer) from public,anon;
grant execute on function public.save_lineup_draft(uuid,uuid,integer,text,jsonb,boolean,integer) to authenticated;
notify pgrst,'reload schema';
commit;
