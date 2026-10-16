begin;

-- Keep compatibility columns empty, including in Realtime row payloads.
lock table public.club_trials, public.call_up_trials in access exclusive mode;
create table public.club_trial_notes (
  trial_id uuid primary key,
  club_id uuid not null,
  notes text not null check (char_length(notes) between 1 and 1000),
  foreign key (club_id,trial_id) references public.club_trials(club_id,id)
    on delete cascade deferrable initially deferred
);
alter table public.call_up_trials add constraint trial_note_snapshot_scope unique(club_id,call_up_id,id);
create table public.call_up_trial_notes (
  trial_id uuid primary key,
  club_id uuid not null,
  call_up_id uuid not null,
  notes text not null check (char_length(notes) between 1 and 1000),
  foreign key (club_id,call_up_id,trial_id) references public.call_up_trials(club_id,call_up_id,id)
    on delete cascade deferrable initially deferred
);
alter table public.club_trial_notes enable row level security;
alter table public.call_up_trial_notes enable row level security;
revoke all on public.club_trial_notes,public.call_up_trial_notes from public,anon,authenticated;
grant select on public.club_trial_notes,public.call_up_trial_notes to authenticated;
create policy trial_notes_captains on public.club_trial_notes for select to authenticated
  using (private.is_admin(club_id));
create policy snapshot_notes_captains on public.call_up_trial_notes for select to authenticated
  using (private.is_admin(club_id));

insert into public.club_trial_notes(trial_id,club_id,notes)
  select id,club_id,notes from public.club_trials where notes is not null and char_length(notes)>0;
insert into public.call_up_trial_notes(trial_id,club_id,call_up_id,notes)
  select id,club_id,call_up_id,notes_snapshot from public.call_up_trials
  where notes_snapshot is not null and char_length(notes_snapshot)>0;
update public.club_trials set notes=null where notes is not null;
update public.call_up_trials set notes_snapshot=null where notes_snapshot is not null;

-- Capture legacy imports and RPC inputs before they enter any member-readable row.
-- Deferred foreign keys allow storing notes before the corresponding trial insert.
create function private.capture_club_trial_notes() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_notes text := nullif(new.notes,'');
begin
  delete from public.club_trial_notes where trial_id=new.id;
  if v_notes is not null then
    insert into public.club_trial_notes(trial_id,club_id,notes) values(new.id,new.club_id,v_notes);
  end if;
  new.notes := null;
  return new;
end;
$$;
create trigger private_trial_notes before insert or update of notes on public.club_trials
  for each row execute function private.capture_club_trial_notes();

create function private.capture_call_up_trial_notes() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_notes text := nullif(new.notes_snapshot,''); v_id uuid := new.id;
begin
  -- A roster refresh uses INSERT ... ON CONFLICT. Its private note must target
  -- the existing snapshot, never the unused candidate ID from that INSERT.
  if tg_op='INSERT' and new.source_trial_id is not null then
    select id into v_id from public.call_up_trials
      where club_id=new.club_id and call_up_id=new.call_up_id and source_trial_id=new.source_trial_id;
    v_id := coalesce(v_id,new.id);
  end if;
  if v_notes is null then
    select notes into v_notes from public.club_trial_notes
      where club_id=new.club_id and trial_id=new.source_trial_id;
  end if;
  delete from public.call_up_trial_notes where trial_id=v_id;
  if v_notes is not null then
    insert into public.call_up_trial_notes(trial_id,club_id,call_up_id,notes)
      values(v_id,new.club_id,new.call_up_id,v_notes);
  end if;
  new.notes_snapshot := null;
  return new;
end;
$$;
-- Runs after filter_excluded_trial, so excluded inserts cannot create orphan notes.
create trigger private_snapshot_notes before insert or update of notes_snapshot on public.call_up_trials
  for each row execute function private.capture_call_up_trial_notes();
revoke all on function private.capture_club_trial_notes(),private.capture_call_up_trial_notes() from public,anon,authenticated;
alter table public.club_trials add constraint trial_notes_are_private check(notes is null);
alter table public.call_up_trials add constraint snapshot_notes_are_private check(notes_snapshot is null);
notify pgrst,'reload schema';
commit;
