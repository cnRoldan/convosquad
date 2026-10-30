begin;
-- Late additions remain possible until the event ends, even after voting closes.
create or replace function private.stamp_aid() returns trigger language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call uuid;
begin
 if tg_op='DELETE' then v_club:=old.club_id;v_call:=old.call_up_id;else v_club:=new.club_id;v_call:=new.call_up_id;end if;
 perform 1 from public.clubs where id=v_club for update;
 if tg_op='DELETE' and not exists(select 1 from public.call_ups where id=v_call) then return old;end if;
 perform 1 from public.call_ups where id=v_call and club_id=v_club and status in ('draft','open','closed') and ends_at>clock_timestamp() for update;
 if not found then raise exception 'Call-up ended' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;
 new.body:=btrim(new.body);
 if tg_op='INSERT' then select coalesce(max(sort_order)+1,0) into new.sort_order from public.call_up_aids where call_up_id=new.call_up_id;end if;
 return new;
end; $$;
create table public.lineup_guests (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null references public.clubs(id) on delete cascade,
 call_up_id uuid references public.call_ups(id) on delete set null,
 kind text not null check(kind in ('aid','trial')),
 name text not null check(length(btrim(name)) between 1 and 64),
 retained boolean not null default false,
 source_trial_id uuid references public.club_trials(id) on delete set null,
 trial_id uuid references public.call_up_trials(id) on delete set null,
 aid_id uuid references public.call_up_aids(id) on delete set null,
 notes text check(length(notes)<=1000),
 phone text check(phone is null or phone ~ '^\+[1-9][0-9]{6,14}$')
);
alter table public.lineup_guests enable row level security;
alter table public.call_up_aids add column lineup_guest_id uuid references public.lineup_guests(id) on delete set null;
revoke all on public.lineup_guests from public,anon,authenticated;
create function public.add_lineup_guest(p_call_id uuid,p_kind text,p_name text,p_notes text,p_phone text,p_retain boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.call_ups; result uuid; source public.club_trials; snapshot public.call_up_trials; aid public.call_up_aids;
begin
 select * into c from public.call_ups where id=p_call_id;
 perform private.require_admin(c.club_id);
 perform 1 from public.clubs where id=c.club_id for update;
 select * into c from public.call_ups where id=p_call_id for update;
 if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended'; end if;
 if p_kind='trial' then
   if p_retain then select * into source from public.save_club_trial_with_contact(c.club_id,p_name,p_notes,p_phone); end if;
   insert into public.call_up_trials(club_id,call_up_id,source_trial_id,ea_id_snapshot,notes_snapshot,sort_order_snapshot,trial_created_at)
   values(c.club_id,c.id,source.id,btrim(p_name),nullif(btrim(p_notes),''),coalesce(source.sort_order,0),now())
   on conflict(call_up_id,source_trial_id) do update set notes_snapshot=excluded.notes_snapshot
   returning * into snapshot;
   if nullif(btrim(p_phone),'') is not null then
     insert into public.call_up_contacts(club_id,call_up_id,trial_id,phone) values(c.club_id,c.id,snapshot.id,btrim(p_phone)) on conflict(trial_id) do update set phone=excluded.phone;
   end if;
 elsif p_kind='aid' then
   insert into public.call_up_aids(club_id,call_up_id,body) values(c.club_id,c.id,btrim(p_name)) returning * into aid;
   if nullif(btrim(p_phone),'') is not null then insert into public.call_up_contacts(club_id,call_up_id,aid_id,phone) values(c.club_id,c.id,aid.id,btrim(p_phone)); end if;
 else raise exception 'Invalid kind'; end if;
 insert into public.lineup_guests(club_id,call_up_id,kind,name,notes,phone,retained)
 values(c.club_id,c.id,p_kind,btrim(p_name),nullif(btrim(p_notes),''),nullif(btrim(p_phone),''),p_retain) returning id into result;
 update public.lineup_guests set source_trial_id=source.id,trial_id=snapshot.id,aid_id=aid.id where id=result;
 if aid.id is not null then update public.call_up_aids set lineup_guest_id=result where id=aid.id;end if;
 return result;
end; $$;
create function public.list_lineup_guests(p_call_id uuid)
returns table(id uuid,name text,kind text,retained boolean,trial_id uuid,aid_id uuid,source_trial_id uuid) language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where call_ups.id=p_call_id;
 if not found or not private.is_member(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 return query select g.id,g.name,g.kind,g.retained,g.trial_id,g.aid_id,g.source_trial_id from public.lineup_guests g where g.club_id=c.club_id and (g.call_up_id=c.id or g.retained) order by g.name;
end; $$;
revoke all on function public.add_lineup_guest(uuid,text,text,text,text,boolean),public.list_lineup_guests(uuid) from public,anon;
grant execute on function public.add_lineup_guest(uuid,text,text,text,text,boolean),public.list_lineup_guests(uuid) to authenticated;
create table public.lineup_guest_calls (
 guest_id uuid references public.lineup_guests(id) on delete cascade,
 call_up_id uuid references public.call_ups(id) on delete cascade,
 primary key(guest_id,call_up_id)
);
alter table public.lineup_guest_calls enable row level security;
revoke all on public.lineup_guest_calls from public,anon,authenticated;
create function private.materialize_lineup_candidates(p_call_id uuid,p_ids text[]) returns void language plpgsql security definer set search_path='' as $$
declare c public.call_ups; g public.lineup_guests; a public.call_up_aids;
begin
 select * into c from public.call_ups where id=p_call_id;
 insert into public.call_up_trials(club_id,call_up_id,source_trial_id,ea_id_snapshot,notes_snapshot,sort_order_snapshot,trial_created_at)
 select t.club_id,c.id,t.id,t.ea_id,n.notes,t.sort_order,t.created_at from public.club_trials t
 left join public.club_trial_notes n on n.trial_id=t.id
 where t.club_id=c.club_id and t.status='active' and (t.id::text=any(p_ids) or exists(select 1 from public.lineup_guests guest where guest.source_trial_id=t.id and guest.id::text=any(p_ids)))
 on conflict(call_up_id,source_trial_id) do nothing;
 for g in select * from public.lineup_guests where club_id=c.club_id and retained and kind='aid' and call_up_id is distinct from c.id and id::text=any(p_ids) loop
   insert into public.lineup_guest_calls values(g.id,c.id) on conflict do nothing;
   if found then
     insert into public.call_up_aids(club_id,call_up_id,body,lineup_guest_id) values(c.club_id,c.id,g.name,g.id) returning * into a;
     if g.phone is not null then insert into public.call_up_contacts(club_id,call_up_id,aid_id,phone) values(c.club_id,c.id,a.id,g.phone);end if;
   end if;
 end loop;
end; $$;
revoke all on function private.materialize_lineup_candidates(uuid,text[]) from public,anon,authenticated;
create function public.list_roster_helpers(p_club_id uuid) returns table(id uuid,name text) language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_club_id) then raise exception 'Not authorized' using errcode='42501';end if;
 return query select g.id,g.name from public.lineup_guests g where g.club_id=p_club_id and g.retained and g.kind='aid' order by g.name;
end; $$;
revoke all on function public.list_roster_helpers(uuid) from public,anon;
grant execute on function public.list_roster_helpers(uuid) to authenticated;
commit;
