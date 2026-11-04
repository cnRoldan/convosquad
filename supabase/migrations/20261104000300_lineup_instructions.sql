begin;

create table public.lineup_draft_instructions (
 draft_id uuid not null references public.call_up_lineup_drafts(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 updated_by uuid references public.profiles(id) on delete set null,
 primary key(draft_id,player_id)
);
create table public.lineup_instructions (
 id uuid not null unique default gen_random_uuid(),
 call_up_id uuid not null references public.call_ups(id) on delete cascade,
 club_id uuid not null references public.clubs(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 recipient_user_id uuid references public.profiles(id) on delete set null,
 player_name text not null,body text not null check(char_length(btrim(body)) between 1 and 1000),
 captain_name text not null,published_at timestamptz not null default clock_timestamp(),
 primary key(call_up_id,player_id)
);
alter table public.lineup_draft_instructions enable row level security;
alter table public.lineup_instructions enable row level security;
revoke all on public.lineup_draft_instructions,public.lineup_instructions from public,anon,authenticated;

create function public.save_lineup_draft_with_instructions(p_call_id uuid,p_draft_id uuid,p_revision integer,p_title text,p_document jsonb,p_submit boolean default false,p_suggested_changes integer default 0,p_instructions jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; saved_id uuid; item record; club uuid;
begin
 select club_id into club from public.call_ups where id=p_call_id;
 perform private.require_admin(club);
 if p_instructions is null or jsonb_typeof(p_instructions)<>'object' or octet_length(p_instructions::text)>100000 then raise exception 'Invalid instructions' using errcode='22023'; end if;
 for item in select * from jsonb_each(p_instructions) loop
  if jsonb_typeof(item.value)<>'string' or char_length(item.value#>>'{}')>1000
    or not exists(select 1 from public.players p where p.club_id=club and p.id::text=item.key) then raise exception 'Invalid instruction player or text' using errcode='22023'; end if;
 end loop;
 result:=public.save_lineup_draft(p_call_id,p_draft_id,p_revision,p_title,p_document,p_submit,p_suggested_changes);
 saved_id:=(result->>'id')::uuid;
 delete from public.lineup_draft_instructions i where i.draft_id=saved_id and (not (p_instructions?i.player_id::text) or btrim(p_instructions->>i.player_id::text)='');
 insert into public.lineup_draft_instructions(draft_id,player_id,body,updated_by)
 select saved_id,key::uuid,btrim(value),auth.uid() from jsonb_each_text(p_instructions) where btrim(value)<>''
 on conflict(draft_id,player_id) do update set body=excluded.body,updated_by=excluded.updated_by where lineup_draft_instructions.body is distinct from excluded.body;
 return result||jsonb_build_object('instructions',coalesce((select jsonb_object_agg(player_id::text,body) from public.lineup_draft_instructions where draft_id=saved_id),'{}'::jsonb));
end; $$;

alter function public.list_lineup_drafts(uuid) rename to list_lineup_drafts_before_instructions;
alter function public.list_lineup_drafts_before_instructions(uuid) set schema private;
revoke all on function private.list_lineup_drafts_before_instructions(uuid) from public,anon,authenticated,service_role;
create function public.list_lineup_drafts(p_call_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare drafts jsonb;
begin
 drafts:=private.list_lineup_drafts_before_instructions(p_call_id);
 return coalesce((select jsonb_agg(d||jsonb_build_object('instructions',coalesce((select jsonb_object_agg(i.player_id::text,i.body) from public.lineup_draft_instructions i where i.draft_id=(d->>'id')::uuid),'{}'::jsonb)) order by ordinal)
 from jsonb_array_elements(drafts) with ordinality as rows(d,ordinal)),'[]'::jsonb);
end; $$;

create function public.read_lineup_instructions(p_call_id uuid)
returns table(id uuid,player_id uuid,player_name text,body text,captain_name text,published_at timestamptz,recipient_linked boolean)
language plpgsql security definer set search_path='' as $$
declare club uuid;
begin
 select club_id into club from public.call_ups where public.call_ups.id=p_call_id;
 if club is null or not private.is_member(club) then raise exception 'Not authorized' using errcode='42501'; end if;
 return query select i.id,i.player_id,i.player_name,i.body,i.captain_name,i.published_at,i.recipient_user_id is not null from public.lineup_instructions i
 where i.call_up_id=p_call_id and i.club_id=club and (private.is_admin(club) or i.recipient_user_id=auth.uid()) order by i.player_name,i.player_id;
end; $$;

alter table public.push_events add column lineup_instruction_id uuid;
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in
 ('published','pending','reminder','vote','cancelled','evaluation','evaluation_deadline','club_approved','club_join_request','lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected','lineup_instruction'));
alter table public.push_events drop constraint push_events_scope_check;
alter table public.push_events add constraint push_events_scope_check check(
 (kind='club_approved' and call_up_id is null and admission_request_id is not null and recipient_user_id is not null and club_name_snapshot is not null)
 or (kind='club_join_request' and call_up_id is null and admission_request_id is not null and recipient_user_id is null and club_name_snapshot is not null)
 or (kind='lineup_instruction' and call_up_id is not null and admission_request_id is null and recipient_user_id is not null and lineup_instruction_id is not null and club_name_snapshot is not null)
 or (kind in ('lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected') and call_up_id is not null and admission_request_id is null and recipient_user_id is null and club_name_snapshot is not null)
 or (kind not in ('club_approved','club_join_request','lineup_review','lineup_suggestion','lineup_selected','lineup_not_selected','lineup_instruction') and call_up_id is not null and admission_request_id is null and recipient_user_id is null));

create or replace function private.filter_push_recipient() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event public.push_events;
begin
 select * into v_event from public.push_events where id=new.event_id and club_id=new.club_id;
 if not found then return new; end if;
 if v_event.kind='lineup_instruction' then
   if new.user_id is distinct from v_event.recipient_user_id
     or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=new.user_id and m.is_active)
     or not exists(select 1 from public.lineup_instructions i where i.id=v_event.lineup_instruction_id and i.call_up_id=v_event.call_up_id and i.club_id=v_event.club_id and i.recipient_user_id=new.user_id) then return null; end if;
 elsif v_event.kind='club_join_request' then
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
end; $$;

alter function public.publish_lineup_draft(uuid,uuid[]) rename to publish_lineup_draft_before_instructions;
alter function public.publish_lineup_draft_before_instructions(uuid,uuid[]) set schema private;
revoke all on function private.publish_lineup_draft_before_instructions(uuid,uuid[]) from public,anon,authenticated,service_role;
create function public.publish_lineup_draft(p_draft_id uuid,p_acknowledged_incidents uuid[] default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare d public.call_up_lineup_drafts; c public.call_ups; instruction public.lineup_instructions; event_id uuid; club_name text;
begin
 select * into d from public.call_up_lineup_drafts where id=p_draft_id;
 perform private.require_admin(d.club_id);
 perform 1 from public.clubs where id=d.club_id for update;
 select * into c from public.call_ups where id=d.call_up_id for update;
 if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended' using errcode='42501'; end if;
 perform private.publish_lineup_draft_before_instructions(p_draft_id,p_acknowledged_incidents);
 select * into d from public.call_up_lineup_drafts where id=p_draft_id;
 delete from public.lineup_instructions i where i.call_up_id=c.id and not exists(
  select 1 from public.lineup_draft_instructions note where note.draft_id=d.id and note.player_id=i.player_id
  and exists(select 1 from jsonb_array_elements(d.document->'slots') slot where slot->>'playerId'=i.player_id::text));
 insert into public.lineup_instructions(call_up_id,club_id,player_id,recipient_user_id,player_name,body,captain_name)
 select c.id,c.club_id,p.id,case when exists(select 1 from public.club_members m where m.club_id=c.club_id and m.user_id=p.user_id and m.is_active) then p.user_id end,
 coalesce(nullif(p.nickname,''),p.ea_id),note.body,coalesce(author.username,'Capitán')
 from public.lineup_draft_instructions note join public.players p on p.id=note.player_id and p.club_id=c.club_id
 left join public.profiles author on author.id=note.updated_by
 where note.draft_id=d.id and exists(select 1 from jsonb_array_elements(d.document->'slots') slot where slot->>'playerId'=p.id::text)
 on conflict(call_up_id,player_id) do update set id=gen_random_uuid(),recipient_user_id=excluded.recipient_user_id,player_name=excluded.player_name,body=excluded.body,captain_name=excluded.captain_name,published_at=clock_timestamp()
 where lineup_instructions.body is distinct from excluded.body or lineup_instructions.recipient_user_id is distinct from excluded.recipient_user_id;
 select name into club_name from public.clubs where id=c.club_id;
 for instruction in select * from public.lineup_instructions where call_up_id=c.id and recipient_user_id is not null loop
  event_id:=null;
  insert into public.push_events(club_id,call_up_id,event_key,kind,club_name_snapshot,actor_user_id,recipient_user_id,lineup_instruction_id)
  values(c.club_id,c.id,'lineup:instruction:'||instruction.id::text,'lineup_instruction',club_name,auth.uid(),instruction.recipient_user_id,instruction.id)
  on conflict(club_id,event_key) do nothing returning id into event_id;
  if event_id is not null then
   insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
   select event_id,c.club_id,pd.device_id,pd.user_id,pd.expo_push_token,false from public.push_devices pd
   where pd.user_id=instruction.recipient_user_id and pd.is_active and pd.expo_push_token is not null;
  end if;
 end loop;
end; $$;

alter function public.claim_push_deliveries(uuid,integer) rename to claim_push_deliveries_before_instructions;
alter function public.claim_push_deliveries_before_instructions(uuid,integer) set schema private;
revoke all on function private.claim_push_deliveries_before_instructions(uuid,integer) from public,anon,authenticated,service_role;
create function public.claim_push_deliveries(p_event_id uuid,p_limit integer default 100) returns setof public.push_deliveries
language plpgsql security definer set search_path='' as $$
declare event public.push_events; c public.call_ups;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
 select * into event from public.push_events where id=p_event_id for update;
 if not found then return; end if;
 if event.kind<>'lineup_instruction' then return query select * from private.claim_push_deliveries_before_instructions(p_event_id,p_limit); return; end if;
 select * into c from public.call_ups where id=event.call_up_id and club_id=event.club_id;
 update public.push_deliveries x set state='skipped' where x.event_id=p_event_id and x.state='pending' and (
  c.id is null or c.status not in ('open','closed') or c.ends_at<=clock_timestamp() or x.user_id is distinct from event.recipient_user_id
  or not exists(select 1 from public.lineup_instructions i where i.id=event.lineup_instruction_id and i.recipient_user_id=x.user_id and i.call_up_id=c.id and i.club_id=c.club_id)
  or not exists(select 1 from public.club_members m where m.club_id=event.club_id and m.user_id=x.user_id and m.is_active)
  or not exists(select 1 from public.push_devices pd where pd.device_id=x.device_id and pd.user_id=x.user_id and pd.is_active and pd.expo_push_token=x.token_snapshot));
 return query with ready as (select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
 update public.push_deliveries x set state='processing',claimed_at=clock_timestamp(),can_vote=false from ready r where x.id=r.id returning x.*;
end; $$;

revoke all on function public.save_lineup_draft_with_instructions(uuid,uuid,integer,text,jsonb,boolean,integer,jsonb),public.list_lineup_drafts(uuid),public.read_lineup_instructions(uuid),public.publish_lineup_draft(uuid,uuid[]),public.claim_push_deliveries(uuid,integer) from public,anon,authenticated;
grant execute on function public.save_lineup_draft_with_instructions(uuid,uuid,integer,text,jsonb,boolean,integer,jsonb),public.list_lineup_drafts(uuid),public.read_lineup_instructions(uuid),public.publish_lineup_draft(uuid,uuid[]) to authenticated;
grant execute on function public.claim_push_deliveries(uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
