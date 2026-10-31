begin;
alter table public.call_up_lineups add column published_by uuid references public.profiles(id), add column published_at timestamptz;
update public.call_up_lineups l set published_by=d.updated_by,published_at=l.updated_at from public.call_up_lineup_drafts d where d.id=l.published_draft_id and l.published_by is null;

create or replace function public.list_lineup_drafts(p_call_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where id=p_call_id; if not found or not private.is_admin(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'ordinal',d.ordinal,'title',d.title,'document',d.document,'revision',d.revision,'submittedAt',d.submitted_at,'createdBy',creator.username,'updatedBy',updater.username,'updatedAt',d.updated_at,'upVotes',(select count(*) from public.call_up_lineup_draft_votes v where v.draft_id=d.id and v.approved),'downVotes',(select count(*) from public.call_up_lineup_draft_votes v where v.draft_id=d.id and not v.approved),'myVote',(select v.approved from public.call_up_lineup_draft_votes v where v.draft_id=d.id and v.user_id=auth.uid()),'published',l.published_draft_id=d.id,'publishedBy',publisher.username,'suggestedChanges',d.last_suggested_changes,'suggestedBy',suggester.username) order by d.ordinal) from public.call_up_lineup_drafts d join public.profiles creator on creator.id=d.created_by join public.profiles updater on updater.id=d.updated_by left join public.profiles suggester on suggester.id=d.last_suggested_by left join public.call_up_lineups l on l.call_up_id=d.call_up_id left join public.profiles publisher on publisher.id=l.published_by where d.call_up_id=c.id),'[]'::jsonb);
end; $$;

create or replace function public.publish_lineup_draft(p_draft_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts; c public.call_ups; u uuid:=private.require_user(); v_event uuid; v_name text; v_actor_name text; selected_ids text[];
begin
 select * into d from public.call_up_lineup_drafts where id=p_draft_id; select * into c from public.call_ups where id=d.call_up_id; perform private.require_admin(c.club_id); perform private.validate_lineup_draft(c.id,d.document,true);
 insert into public.call_up_lineups(call_up_id,club_id,draft,published,published_draft_id,published_by,published_at) values(c.id,c.club_id,d.document,d.document,d.id,u,now()) on conflict(call_up_id) do update set draft=excluded.draft,published=excluded.published,published_draft_id=excluded.published_draft_id,published_by=excluded.published_by,published_at=excluded.published_at,revision=call_up_lineups.revision+1,updated_at=now();
 select array_agg(value->>'playerId') into selected_ids from jsonb_array_elements(d.document->'slots') where value->>'playerId' is not null;
 select name into v_name from public.clubs where id=c.club_id; select username into v_actor_name from public.profiles where id=u;
 insert into public.push_events(club_id,call_up_id,event_key,kind,club_name_snapshot,actor_user_id,actor_ea_id,lineup_draft_id,lineup_draft_title) values(c.club_id,c.id,'lineup:selected:'||d.id::text||':'||d.revision::text,'lineup_selected',v_name,u,v_actor_name,d.id,d.title) on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is not null then insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote) select v_event,c.club_id,pd.device_id,pd.user_id,pd.expo_push_token,false from public.push_devices pd join public.call_up_players p on p.user_id=pd.user_id and p.call_up_id=c.id where pd.is_active and pd.expo_push_token is not null and pd.user_id<>u and p.source_player_id::text=any(selected_ids); end if;
 v_event:=null;
 insert into public.push_events(club_id,call_up_id,event_key,kind,club_name_snapshot,actor_user_id,actor_ea_id,lineup_draft_id,lineup_draft_title) values(c.club_id,c.id,'lineup:not-selected:'||d.id::text||':'||d.revision::text,'lineup_not_selected',v_name,u,v_actor_name,d.id,d.title) on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is not null then insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote) select v_event,c.club_id,pd.device_id,pd.user_id,pd.expo_push_token,false from public.push_devices pd join public.call_up_players p on p.user_id=pd.user_id and p.call_up_id=c.id where pd.is_active and pd.expo_push_token is not null and pd.user_id<>u and (selected_ids is null or p.source_player_id::text<>all(selected_ids)); end if;
end; $$;
notify pgrst,'reload schema';
commit;
