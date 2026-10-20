begin;
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check(kind in ('published','pending','reminder','vote','cancelled','evaluation','club_approved','club_join_request'));
alter table public.push_events drop constraint push_events_scope_check;
alter table public.push_events add constraint push_events_scope_check check(
 (kind='club_approved' and call_up_id is null and admission_request_id is not null and recipient_user_id is not null and club_name_snapshot is not null)
 or (kind='club_join_request' and call_up_id is null and admission_request_id is not null and recipient_user_id is null and club_name_snapshot is not null)
 or (kind not in ('club_approved','club_join_request') and call_up_id is not null and admission_request_id is null and recipient_user_id is null));

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
 elsif not private.notification_recipient_allowed(new.club_id,v_event.call_up_id,new.user_id,v_event.kind) then return null;
 end if;
 return new;
end;
$$;

create or replace function public.claim_push_deliveries(p_event_id uuid,p_limit integer default 100)
returns setof public.push_deliveries language plpgsql security definer set search_path='' as $$
declare v_event public.push_events;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
 select * into v_event from public.push_events where id=p_event_id for update;
 if not found then return; end if;
 if v_event.kind not in ('club_approved','club_join_request') then return query select * from private.claim_call_up_push_deliveries(p_event_id,p_limit); return; end if;
 update public.push_deliveries x set state='skipped' where event_id=p_event_id and state='pending' and (
   (v_event.kind='club_approved' and (x.user_id is distinct from v_event.recipient_user_id
     or not exists(select 1 from public.join_requests r where r.id=v_event.admission_request_id and r.club_id=v_event.club_id and r.user_id=x.user_id and r.status='approved')))
   or (v_event.kind='club_join_request' and (
     not exists(select 1 from public.join_requests r where r.id=v_event.admission_request_id and r.club_id=v_event.club_id and r.status='pending')
     or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active and m.role='admin')))
   or not exists(select 1 from public.club_members m where m.club_id=v_event.club_id and m.user_id=x.user_id and m.is_active)
   or not exists(select 1 from public.push_devices d where d.device_id=x.device_id and d.user_id=x.user_id and d.is_active and d.expo_push_token=x.token_snapshot)
 );
 return query with ready as(select id from public.push_deliveries where event_id=p_event_id and state='pending' order by id limit p_limit for update skip locked)
 update public.push_deliveries x set state='processing',claimed_at=now(),can_vote=false from ready r where x.id=r.id returning x.*;
end;
$$;

create function private.notify_join_request() returns trigger language plpgsql security definer set search_path='' as $$
declare v_event uuid; v_club_name text; v_username text;
begin
 if new.status<>'pending' then return new; end if;
 select name into v_club_name from public.clubs where id=new.club_id;
 select username into v_username from public.profiles where id=new.user_id;
 insert into public.push_events(club_id,event_key,kind,admission_request_id,club_name_snapshot,actor_user_id,actor_ea_id)
 values(new.club_id,'club-join-request:'||new.id::text,'club_join_request',new.id,v_club_name,new.user_id,v_username)
 on conflict(club_id,event_key) do nothing returning id into v_event;
 if v_event is not null then
   insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot,can_vote)
   select v_event,new.club_id,d.device_id,d.user_id,d.expo_push_token,false
   from public.push_devices d join public.club_members m on m.user_id=d.user_id and m.club_id=new.club_id
   where m.is_active and m.role='admin' and d.is_active and d.expo_push_token is not null;
 end if;
 return new;
end;
$$;
create trigger notify_join_request after insert on public.join_requests for each row execute function private.notify_join_request();
revoke all on function private.notify_join_request() from public,anon,authenticated;

-- Existing RLS keeps applicant data visible only to that applicant and active captains.
do $$
declare v_table text;
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
 if not exists(select 1 from pg_publication where pubname='supabase_realtime' and puballtables) then
   foreach v_table in array array['join_requests','club_members'] loop
     if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
       execute format('alter publication supabase_realtime add table public.%I',v_table);
     end if;
   end loop;
 end if;
end;
$$;
notify pgrst,'reload schema';
commit;
