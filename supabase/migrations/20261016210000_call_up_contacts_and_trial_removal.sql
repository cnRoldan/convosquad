begin;

create table public.club_trial_contacts (
  trial_id uuid primary key,
  club_id uuid not null,
  phone text not null check(phone ~ '^\+[1-9][0-9]{6,14}$'),
  foreign key(club_id,trial_id) references public.club_trials(club_id,id) on delete cascade
);
create table public.call_up_contacts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  call_up_id uuid not null,
  trial_id uuid unique references public.call_up_trials(id) on delete cascade,
  aid_id uuid unique references public.call_up_aids(id) on delete cascade,
  phone text not null check(phone ~ '^\+[1-9][0-9]{6,14}$'),
  check(num_nonnulls(trial_id,aid_id)=1),
  foreign key(club_id,call_up_id) references public.call_ups(club_id,id) on delete cascade
);
create table public.call_up_trial_exclusions (
  club_id uuid not null,
  call_up_id uuid not null,
  source_trial_id uuid not null,
  primary key(call_up_id,source_trial_id),
  foreign key(club_id,call_up_id) references public.call_ups(club_id,id) on delete cascade,
  foreign key(club_id,source_trial_id) references public.club_trials(club_id,id) on delete cascade
);
alter table public.club_trial_contacts enable row level security;
alter table public.call_up_contacts enable row level security;
alter table public.call_up_trial_exclusions enable row level security;
revoke all on public.club_trial_contacts,public.call_up_contacts,public.call_up_trial_exclusions from public,anon,authenticated;
grant select on public.club_trial_contacts,public.call_up_contacts,public.call_up_trial_exclusions to authenticated;
create policy trial_contacts_captains on public.club_trial_contacts for select to authenticated using(private.is_admin(club_id));
create policy call_contacts_captains on public.call_up_contacts for select to authenticated using(private.is_admin(club_id));
create policy trial_exclusions_captains on public.call_up_trial_exclusions for select to authenticated using(private.is_admin(club_id));

create function private.trial_snapshot_contact() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_when='BEFORE' then
    if exists(select 1 from public.call_up_trial_exclusions where call_up_id=new.call_up_id and club_id=new.club_id and source_trial_id=new.source_trial_id) then return null; end if;
  else
    insert into public.call_up_contacts(club_id,call_up_id,trial_id,phone)
      select new.club_id,new.call_up_id,new.id,c.phone from public.club_trial_contacts c
      where c.club_id=new.club_id and c.trial_id=new.source_trial_id;
  end if;
  return new;
end;
$$;
create trigger filter_excluded_trial before insert on public.call_up_trials for each row execute function private.trial_snapshot_contact();
create trigger copy_trial_contact after insert on public.call_up_trials for each row execute function private.trial_snapshot_contact();
revoke all on function private.trial_snapshot_contact() from public,anon,authenticated;

create function public.save_call_up_contact(p_call_up_id uuid,p_kind text,p_entry_id uuid,p_phone text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups; v_source uuid; v_phone text:=nullif(btrim(p_phone),'');
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id=v_club for update;
  select * into v_call from public.call_ups where id=p_call_up_id for update;
  if v_call.status not in ('open','draft') or v_call.local_date<(now() at time zone v_call.timezone)::date then raise exception 'Read only call-up' using errcode='42501'; end if;
  if v_phone is not null and (char_length(v_phone)>16 or v_phone !~ '^\+[1-9][0-9]{6,14}$') then raise exception 'Invalid phone' using errcode='22023'; end if;
  if p_kind='trial' then
    select source_trial_id into v_source from public.call_up_trials where id=p_entry_id and club_id=v_club and call_up_id=v_call.id;
    if not found then raise exception 'Trial mismatch' using errcode='42501'; end if;
    delete from public.call_up_contacts where trial_id=p_entry_id;
    if v_source is not null then
      delete from public.club_trial_contacts where trial_id=v_source and club_id=v_club;
      if v_phone is not null then insert into public.club_trial_contacts values(v_source,v_club,v_phone); end if;
    end if;
    if v_phone is not null then insert into public.call_up_contacts(club_id,call_up_id,trial_id,phone) values(v_club,v_call.id,p_entry_id,v_phone); end if;
  elsif p_kind='aid' then
    if not exists(select 1 from public.call_up_aids where id=p_entry_id and club_id=v_club and call_up_id=v_call.id) then raise exception 'Aid mismatch' using errcode='42501'; end if;
    delete from public.call_up_contacts where aid_id=p_entry_id;
    if v_phone is not null then insert into public.call_up_contacts(club_id,call_up_id,aid_id,phone) values(v_club,v_call.id,p_entry_id,v_phone); end if;
  else raise exception 'Invalid contact kind' using errcode='22023'; end if;
end;
$$;

create function public.add_call_up_trial_with_contact(p_call_up_id uuid,p_name text,p_phone text default null)
returns public.call_up_trials language plpgsql security definer set search_path='' as $$
declare v_trial public.call_up_trials;
begin
  select * into v_trial from public.add_call_up_trial(p_call_up_id,p_name,null);
  perform public.save_call_up_contact(p_call_up_id,'trial',v_trial.id,p_phone);
  return v_trial;
end;
$$;

create function public.save_call_up_aid_with_contact(p_call_up_id uuid,p_body text,p_phone text default null,p_aid_id uuid default null)
returns public.call_up_aids language plpgsql security definer set search_path='' as $$
declare v_club uuid; v_call public.call_ups; v_aid public.call_up_aids;
begin
  select club_id into v_club from public.call_ups where id=p_call_up_id;
  perform private.require_admin(v_club);
  perform 1 from public.clubs where id=v_club for update;
  select * into v_call from public.call_ups where id=p_call_up_id for update;
  if v_call.status not in ('open','draft') or v_call.local_date<(now() at time zone v_call.timezone)::date then raise exception 'Read only call-up' using errcode='42501'; end if;
  if p_aid_id is null then
    insert into public.call_up_aids(club_id,call_up_id,body) values(v_club,v_call.id,p_body) returning * into v_aid;
  else
    update public.call_up_aids set body=p_body where id=p_aid_id and club_id=v_club and call_up_id=v_call.id returning * into v_aid;
    if not found then raise exception 'Aid mismatch' using errcode='42501'; end if;
  end if;
  perform public.save_call_up_contact(v_call.id,'aid',v_aid.id,p_phone);
  return v_aid;
end;
$$;

create function public.remove_call_up_trial(p_trial_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_trial public.call_up_trials; v_call public.call_ups;
begin
  select * into v_trial from public.call_up_trials where id=p_trial_id;
  perform private.require_admin(v_trial.club_id);
  perform 1 from public.clubs where id=v_trial.club_id for update;
  select * into v_call from public.call_ups where id=v_trial.call_up_id for update;
  if v_call.status not in ('open','draft') or v_call.local_date<(now() at time zone v_call.timezone)::date then raise exception 'Read only call-up' using errcode='42501'; end if;
  if v_trial.source_trial_id is not null then
    insert into public.call_up_trial_exclusions values(v_trial.club_id,v_trial.call_up_id,v_trial.source_trial_id) on conflict do nothing;
  end if;
  delete from public.call_up_trials where id=v_trial.id and club_id=v_trial.club_id;
end;
$$;
revoke all on function public.save_call_up_contact(uuid,text,uuid,text),public.add_call_up_trial_with_contact(uuid,text,text),public.save_call_up_aid_with_contact(uuid,text,text,uuid),public.remove_call_up_trial(uuid) from public,anon,authenticated;
grant execute on function public.save_call_up_contact(uuid,text,uuid,text),public.add_call_up_trial_with_contact(uuid,text,text),public.save_call_up_aid_with_contact(uuid,text,text,uuid),public.remove_call_up_trial(uuid) to authenticated;
create or replace function private.can_manage_call_up(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.call_ups c where c.id=p_id and c.status in ('draft','open')
    and c.local_date >= (now() at time zone c.timezone)::date and private.is_admin(c.club_id));
$$;
notify pgrst,'reload schema';
commit;
