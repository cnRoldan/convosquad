begin;

alter table public.push_events add column lineup_draft_id uuid references public.call_up_lineup_drafts(id) on delete cascade,
  add column lineup_draft_title text;
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in
  ('published','pending','reminder','vote','cancelled','evaluation','evaluation_deadline','club_approved','club_join_request',
   'lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected'));
alter table public.push_events drop constraint push_events_scope_check;
alter table public.push_events add constraint push_events_scope_check check(
 (kind='club_approved' and call_up_id is null and admission_request_id is not null and recipient_user_id is not null and club_name_snapshot is not null)
 or (kind='club_join_request' and call_up_id is null and admission_request_id is not null and recipient_user_id is null and club_name_snapshot is not null)
 or (kind in ('lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected') and call_up_id is not null and admission_request_id is null and recipient_user_id is null and club_name_snapshot is not null)
 or (kind not in ('club_approved','club_join_request','lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected') and call_up_id is not null and admission_request_id is null and recipient_user_id is null));

create or replace function private.filter_push_recipient() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event public.push_events;
begin
 select * into v_event from public.push_events where id=new.event_id and club_id=new.club_id;
 if not found then return new; end if;
 if v_event.kind='club_join_request' then
   if not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=new.user_id and m.is_active and m.role='admin')
     or not exists(select 1 from public.join_requests r where r.id=v_event.admission_request_id and r.club_id=v_event.club_id and r.status='pending') then return null; end if;
 elsif v_event.kind='club_approved' then
   if new.user_id is distinct from v_event.recipient_user_id or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=new.user_id and m.is_active) then return null; end if;
 elsif v_event.kind in ('lineup_review','lineup_suggestion') then
   if new.user_id=v_event.actor_user_id or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=new.user_id and m.is_active and m.role='admin') then return null; end if;
 elsif v_event.kind in ('lineup_selected','lineup_not_selected') then
   if new.user_id=v_event.actor_user_id or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=new.user_id and m.is_active) then return null; end if;
 elsif not private.notification_recipient_allowed(new.club_id,v_event.call_up_id,new.user_id,v_event.kind) then return null;
 end if;
 return new;
end;
$$;

create or replace function public.claim_push_deliveries(p_event_id uuid,p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path='' as $$
declare v_event public.push_events; v_call public.call_ups;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
 select * into v_event from public.push_events where id=p_event_id for update;
 if not found then return; end if;
 if v_event.kind not in ('lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected') then
   return query select * from private.claim_call_up_push_deliveries(p_event_id,p_limit); return;
 end if;
 select * into v_call from public.call_ups where id=v_event.call_up_id and club_id=v_event.club_id;
 update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
   v_call.id is null or v_call.status not in ('open','closed') or v_call.ends_at<=clock_timestamp()
   or x.user_id=v_event.actor_user_id
   or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
   or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
   or (v_event.kind in ('lineup_review','lineup_suggestion') and not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active and m.role='admin'))
 );
 return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
 update public.push_deliveries x set state='processing',claimed_at=now(),can_vote=false from ready r where x.id=r.id returning x.*;
end;
$$;

create or replace function private.enqueue_lineup_push(p_kind text,p_draft public.call_up_lineup_drafts,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_event uuid; v_name text; v_actor_name text;
begin
 select name into v_name from public.clubs where id=p_draft.club_id;
 select username into v_actor_name from public.profiles where id=p_actor;
 insert into public.push_events(club_id,call_up_id,event_key,kind,club_name_snapshot,actor_user_id,actor_ea_id,lineup_draft_id,lineup_draft_title)
 values(p_draft.club_id,p_draft.call_up_id,'lineup:'||p_kind||':'||p_draft.id::text||':'||p_draft.revision::text,p_kind,v_name,p_actor,v_actor_name,p_draft.id,p_draft.title)
 on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is null then return; end if;
 insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
 select v_event,p_draft.club_id,d.device_id,d.user_id,d.expo_push_token,false from public.push_devices d
 join public.club_members m on m.club_id=p_draft.club_id and m.user_id=d.user_id
 where d.is_active and d.expo_push_token is not null and m.is_active and d.user_id<>p_actor
   and (p_kind not in ('lineup_review','lineup_suggestion') or m.role='admin');
end;
$$;

create or replace function public.save_lineup_draft(p_call_id uuid,p_draft_id uuid,p_revision integer,p_title text,p_document jsonb,p_submit boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.call_ups; d public.call_up_lineup_drafts; n integer; u uuid:=private.require_user(); was_submitted boolean:=false;
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
  was_submitted:=d.submitted_at is not null;
  update public.call_up_lineup_drafts set title=btrim(p_title),document=p_document,revision=revision+1,updated_by=u,updated_at=now(),submitted_at=case when p_submit then now() else submitted_at end where id=d.id returning * into d;
  delete from public.call_up_lineup_draft_votes where draft_id=d.id;
 end if;
 if p_submit then perform private.enqueue_lineup_push(case when was_submitted then 'lineup_suggestion' else 'lineup_review' end,d,u); end if;
 return jsonb_build_object('id',d.id,'ordinal',d.ordinal,'title',d.title,'document',d.document,'revision',d.revision,'submittedAt',d.submitted_at);
end; $$;

create or replace function public.publish_lineup_draft(p_draft_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts; c public.call_ups; u uuid:=private.require_user(); v_event uuid; v_name text; v_actor_name text; selected_ids text[];
begin
 select * into d from public.call_up_lineup_drafts where id=p_draft_id; select * into c from public.call_ups where id=d.call_up_id; perform private.require_admin(c.club_id); perform private.validate_lineup_draft(c.id,d.document,true);
 insert into public.call_up_lineups(call_up_id,club_id,draft,published) values(c.id,c.club_id,d.document,d.document) on conflict(call_up_id) do update set draft=excluded.draft,published=excluded.published,revision=call_up_lineups.revision+1,updated_at=now();
 select array_agg(value->>'playerId') into selected_ids from jsonb_array_elements(d.document->'slots') where value->>'playerId' is not null;
 select name into v_name from public.clubs where id=c.club_id; select username into v_actor_name from public.profiles where id=u;
 insert into public.push_events(club_id,call_up_id,event_key,kind,club_name_snapshot,actor_user_id,actor_ea_id,lineup_draft_id,lineup_draft_title) values(c.club_id,c.id,'lineup:selected:'||d.id::text||':'||d.revision::text,'lineup_selected',v_name,u,v_actor_name,d.id,d.title) on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is not null then insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote) select v_event,c.club_id,pd.device_id,pd.user_id,pd.expo_push_token,false from public.push_devices pd join public.call_up_players p on p.user_id=pd.user_id and p.call_up_id=c.id where pd.is_active and pd.expo_push_token is not null and pd.user_id<>u and p.source_player_id::text=any(selected_ids); end if;
 v_event:=null;
 insert into public.push_events(club_id,call_up_id,event_key,kind,club_name_snapshot,actor_user_id,actor_ea_id,lineup_draft_id,lineup_draft_title) values(c.club_id,c.id,'lineup:not-selected:'||d.id::text||':'||d.revision::text,'lineup_not_selected',v_name,u,v_actor_name,d.id,d.title) on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is not null then insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote) select v_event,c.club_id,pd.device_id,pd.user_id,pd.expo_push_token,false from public.push_devices pd join public.call_up_players p on p.user_id=pd.user_id and p.call_up_id=c.id where pd.is_active and pd.expo_push_token is not null and pd.user_id<>u and (selected_ids is null or p.source_player_id::text<>all(selected_ids)); end if;
end; $$;

revoke all on function private.enqueue_lineup_push(text,public.call_up_lineup_drafts,uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
