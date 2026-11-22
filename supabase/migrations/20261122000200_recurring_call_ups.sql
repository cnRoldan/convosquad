begin;
create table public.recurring_call_ups (
 id uuid primary key default gen_random_uuid(),
 club_id uuid not null unique references public.clubs(id) on delete cascade,
 created_by uuid references public.profiles(id) on delete set null,
 timezone text not null,
 weekdays integer[] not null check(cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
 start_time time not null,
 end_time time not null,
 notice_time time,
 closing_time time,
 ratings_enabled boolean not null,
 next_date date not null,
 enabled boolean not null default true,
 last_error text,
 updated_at timestamptz not null default now()
);
alter table public.recurring_call_ups enable row level security;
revoke all on public.recurring_call_ups from public,anon,authenticated;
grant select on public.recurring_call_ups to authenticated;
create policy recurring_call_ups_read_captain on public.recurring_call_ups for select to authenticated using(private.is_admin(club_id));

create function private.recurring_local_instant(p_date date,p_time time,p_timezone text)
returns timestamptz language plpgsql stable set search_path='' as $$
declare candidate timestamptz; matches integer;
begin
 candidate:=(p_date+p_time) at time zone p_timezone;
 select count(*) into matches from generate_series(-840,840,15) offset_minutes
 where ((candidate+offset_minutes*interval '1 minute') at time zone p_timezone)=p_date+p_time;
 if matches<>1 then raise exception 'Ambiguous or missing recurring local time' using errcode='22023'; end if;
 return candidate;
end;
$$;
create function private.recurring_next_date(p_after date,p_weekdays integer[])
returns date language sql immutable set search_path='' as $$
 select min(p_after+n) from generate_series(1,7) n where extract(isodow from p_after+n)::integer=any(p_weekdays)
$$;
create function private.create_recurring_occurrence(r public.recurring_call_ups,p_date date)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare starts timestamptz; ends timestamptz; notice timestamptz; closing timestamptz; c public.call_ups;
begin
 starts:=private.recurring_local_instant(p_date,r.start_time,r.timezone);
 ends:=private.recurring_local_instant(p_date+case when r.end_time<=r.start_time then 1 else 0 end,r.end_time,r.timezone);
 if r.notice_time is not null then notice:=private.recurring_local_instant(p_date,r.notice_time,r.timezone); end if;
 if r.closing_time is not null then closing:=private.recurring_local_instant(p_date,r.closing_time,r.timezone); end if;
 select * into c from public.create_call_up_with_end(r.club_id,starts,ends,notice,'open',closing,r.ratings_enabled);
 return c;
end;
$$;
create function public.create_recurring_call_up(p_club_id uuid,p_first_date date,p_weekdays integer[],p_start_time time,p_end_time time,
 p_notice_time time default null,p_closing_time time default null,p_ratings_enabled boolean default true)
returns public.call_ups language plpgsql security definer set search_path='' as $$
declare r public.recurring_call_ups; tz text; c public.call_ups; days integer[];
begin
 perform 1 from public.clubs where id=p_club_id for update;
 perform private.require_admin(p_club_id);
 select timezone into tz from public.clubs where id=p_club_id;
 select array_agg(distinct day order by day) into days from unnest(p_weekdays) day;
 if p_first_date is null or p_start_time is null or p_end_time is null or p_ratings_enabled is null
 or p_start_time>=time '24:00' or p_end_time>=time '24:00' or p_notice_time>=time '24:00' or p_closing_time>=time '24:00'
 or cardinality(days) is null or cardinality(days) not between 1 and 7 or array_position(p_weekdays,null) is not null
 or not (days <@ array[1,2,3,4,5,6,7]) or not (extract(isodow from p_first_date)::integer=any(days))
 or (p_notice_time is not null and p_notice_time>=p_start_time)
 or (p_closing_time is not null and p_closing_time>p_start_time)
 or (p_notice_time is not null and p_closing_time is not null and p_notice_time>=p_closing_time)
 or private.recurring_local_instant(p_first_date,p_start_time,tz)<=clock_timestamp()
 or (p_closing_time is not null and private.recurring_local_instant(p_first_date,p_closing_time,tz)<=clock_timestamp()) then
 raise exception 'Invalid recurring schedule' using errcode='22023'; end if;
 if exists(select 1 from public.recurring_call_ups where club_id=p_club_id and enabled) then
 raise exception 'Recurring schedule already enabled' using errcode='P0050'; end if;
 insert into public.recurring_call_ups(club_id,created_by,timezone,weekdays,start_time,end_time,notice_time,closing_time,ratings_enabled,next_date)
 values(p_club_id,auth.uid(),tz,days,p_start_time,p_end_time,p_notice_time,p_closing_time,p_ratings_enabled,private.recurring_next_date(p_first_date,days))
 on conflict(club_id) do update set created_by=excluded.created_by,timezone=excluded.timezone,weekdays=excluded.weekdays,start_time=excluded.start_time,
 end_time=excluded.end_time,notice_time=excluded.notice_time,closing_time=excluded.closing_time,ratings_enabled=excluded.ratings_enabled,
 next_date=excluded.next_date,enabled=true,last_error=null,updated_at=now() returning * into r;
 select * into c from private.create_recurring_occurrence(r,p_first_date);
 return c;
end;
$$;
create function public.stop_recurring_call_up(p_club_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.clubs where id=p_club_id for update;
 perform private.require_admin(p_club_id);
 update public.recurring_call_ups set enabled=false,updated_at=now() where club_id=p_club_id;
end;
$$;

-- Only the server scheduler may create subsequent occurrences. Never backfill old days.
create function private.generate_recurring_call_ups()
returns integer language plpgsql security definer set search_path='' as $$
declare r public.recurring_call_ups; today date; target date; made integer:=0; prior text:=current_setting('request.jwt.claim.sub',true); code text;
begin
 for r in select * from public.recurring_call_ups where enabled and next_date<=(clock_timestamp() at time zone timezone)::date+1 order by next_date,id limit 1000 loop
  -- Use the same lock order as captain management and the existing creation functions.
  perform 1 from public.clubs where id=r.club_id for update;
  select * into r from public.recurring_call_ups where id=r.id and enabled for update;
  if not found then continue; end if;
  if not exists(select 1 from public.clubs c where c.id=r.club_id and c.timezone=r.timezone) then
   update public.recurring_call_ups set enabled=false,last_error='timezone_changed',updated_at=now() where id=r.id; continue;
  end if;
  today:=(clock_timestamp() at time zone r.timezone)::date;
  if r.next_date>today+1 then continue; end if;
  if r.created_by is null or not exists(select 1 from public.club_members m where m.club_id=r.club_id and m.user_id=r.created_by and m.role='admin' and m.is_active) then
   update public.recurring_call_ups set enabled=false,last_error='captain_unavailable',updated_at=now() where id=r.id; continue;
  end if;
  target:=greatest(r.next_date,today);
  if not (extract(isodow from target)::integer=any(r.weekdays)) then target:=private.recurring_next_date(target,r.weekdays); end if;
  update public.recurring_call_ups set next_date=case when target<=today+1 then private.recurring_next_date(target,r.weekdays) else target end,updated_at=now() where id=r.id;
  if target>today+1 or exists(select 1 from public.call_ups c where c.club_id=r.club_id and c.local_date=target) then continue; end if;
  begin
   if private.recurring_local_instant(target,r.start_time,r.timezone)<=clock_timestamp() then continue; end if;
   -- A late worker must not publish an already closed voting session.
   if r.closing_time is not null and private.recurring_local_instant(target,r.closing_time,r.timezone)<=clock_timestamp() then continue; end if;
   perform set_config('request.jwt.claim.sub',r.created_by::text,true);
   perform private.create_recurring_occurrence(r,target);
   made:=made+1;
   update public.recurring_call_ups set last_error=null where id=r.id;
  exception when others then
   get stacked diagnostics code=returned_sqlstate;
   update public.recurring_call_ups set last_error=case when code='P0045' then 'activation_required' else 'creation_failed' end,
    enabled=case when code='P0045' then false else enabled end,
    next_date=case when code in ('40001','40P01','55P03','57014') then target else next_date end,updated_at=now() where id=r.id;
  end;
  perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);
 return made;
end;
$$;
revoke all on function private.recurring_local_instant(date,time,text),private.recurring_next_date(date,integer[]),
 private.create_recurring_occurrence(public.recurring_call_ups,date),private.generate_recurring_call_ups() from public,anon,authenticated;
revoke all on function public.create_recurring_call_up(uuid,date,integer[],time,time,time,time,boolean),public.stop_recurring_call_up(uuid) from public,anon,authenticated;
grant execute on function public.create_recurring_call_up(uuid,date,integer[],time,time,time,time,boolean),public.stop_recurring_call_up(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  execute $job$select cron.schedule('convosquad-recurring-call-ups','* * * * *','select private.generate_recurring_call_ups()')$job$;
 end if;
end $$;
commit;
