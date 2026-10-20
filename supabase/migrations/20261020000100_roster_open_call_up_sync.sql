begin;

-- Serialize with call-up creation/closing (the existing category trigger locks the club).
-- Add only active players to current open calls; never rewrite historical snapshots.
create function private.sync_new_player_to_open_calls() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_call public.call_ups;
begin
  if not new.is_active then return new; end if;
  if tg_op='UPDATE' and old.is_active and new.user_id is not distinct from old.user_id then return new; end if;
  select m.user_id into v_user from public.club_members m
    where m.club_id=new.club_id and m.user_id=new.user_id and m.is_active;
  for v_call in select * from public.call_ups c where c.club_id=new.club_id and c.status='open'
    and c.local_date >= (clock_timestamp() at time zone c.timezone)::date
    order by c.id for update loop
    insert into public.call_up_players as snapshot
      (club_id,call_up_id,source_player_id,user_id,ea_id_snapshot,jersey_number_snapshot,position_snapshot,category_snapshot,sort_order_snapshot)
    values(new.club_id,v_call.id,new.id,v_user,new.ea_id,new.jersey_number,new.position,new.category,new.sort_order)
    on conflict(call_up_id,source_player_id) do update set
      user_id=excluded.user_id,
      availability=case when snapshot.user_id is not distinct from excluded.user_id then snapshot.availability else 'unanswered'::public.availability_status end,
      responded_at=case when snapshot.user_id is not distinct from excluded.user_id then snapshot.responded_at else null end,
      updated_at=clock_timestamp()
    where snapshot.user_id is distinct from excluded.user_id;
  end loop;
  return new;
end;
$$;
create trigger sync_new_player_to_open_calls after insert or update of is_active,user_id on public.players
for each row execute function private.sync_new_player_to_open_calls();
revoke all on function private.sync_new_player_to_open_calls() from public,anon,authenticated;

-- Recover an inactive record, retaining its identity/account/history; don't duplicate it.
create function public.add_or_restore_player(p_club_id uuid,p_ea_id text,p_category public.roster_category,p_jersey_number smallint default null)
returns public.players language plpgsql security definer set search_path='' as $$
declare v_player public.players; v_name text:=btrim(p_ea_id);
begin
  perform private.require_admin(p_club_id);
  perform 1 from public.clubs where id=p_club_id for update;
  if v_name is null or length(v_name) not between 1 and 64 or p_category is null then
    raise exception 'Invalid player data' using errcode='22023';
  end if;
  select * into v_player from public.players where club_id=p_club_id and lower(ea_id)=lower(v_name) for update;
  if found then
    if v_player.is_active then raise exception 'Player is already active' using errcode='P0041'; end if;
    update public.players set is_active=true,ea_id=v_name,category=p_category,jersey_number=p_jersey_number
      where id=v_player.id returning * into v_player;
  else
    insert into public.players(club_id,ea_id,category,jersey_number) values(p_club_id,v_name,p_category,p_jersey_number)
      returning * into v_player;
  end if;
  return v_player;
end;
$$;
revoke all on function public.add_or_restore_player(uuid,text,public.roster_category,smallint) from public,anon,authenticated;
grant execute on function public.add_or_restore_player(uuid,text,public.roster_category,smallint) to authenticated;
-- Repair missing candidates from additions made before this migration; existing votes are untouched.
insert into public.call_up_players
  (club_id,call_up_id,source_player_id,user_id,ea_id_snapshot,jersey_number_snapshot,position_snapshot,category_snapshot,sort_order_snapshot)
select p.club_id,c.id,p.id,case when m.is_active then p.user_id end,p.ea_id,p.jersey_number,p.position,p.category,p.sort_order
from public.players p join public.call_ups c on c.club_id=p.club_id
left join public.club_members m on m.club_id=p.club_id and m.user_id=p.user_id
where p.is_active and c.status='open' and c.local_date >= (clock_timestamp() at time zone c.timezone)::date
on conflict(call_up_id,source_player_id) do nothing;
notify pgrst,'reload schema';
commit;
