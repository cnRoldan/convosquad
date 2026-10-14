begin;

alter policy call_ups_read on public.call_ups using (
  private.is_admin(club_id) or (
    status = 'open' and private.is_member(club_id)
    and local_date >= (now() at time zone timezone)::date
  )
);

create function public.list_call_up_history(p_club_id uuid)
returns setof public.call_ups language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin(p_club_id);
  return query select c.* from public.call_ups c where c.club_id = p_club_id
    and c.local_date < (now() at time zone c.timezone)::date
    order by c.starts_at desc, c.id desc limit 10;
end;
$$;
revoke all on function public.list_call_up_history(uuid) from public, anon, authenticated;
grant execute on function public.list_call_up_history(uuid) to authenticated;

create or replace function public.respond_to_call_up(p_call_up_player_id uuid, p_availability public.availability_status)
returns public.call_up_players language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.require_user(); v_entry public.call_up_players; v_call public.call_ups; v_club_id uuid;
begin
  select c.club_id into v_club_id from public.call_up_players s join public.call_ups c on c.id = s.call_up_id where s.id = p_call_up_player_id;
  perform 1 from public.clubs where id = v_club_id for update;
  select c.* into v_call from public.call_ups c join public.call_up_players s on s.call_up_id = c.id where s.id = p_call_up_player_id for update of c;
  select * into v_entry from public.call_up_players where id = p_call_up_player_id for update;
  if not found or v_entry.user_id is distinct from v_user or not private.is_member(v_entry.club_id)
    or v_call.status <> 'open' or v_call.local_date < (now() at time zone v_call.timezone)::date then
    raise exception 'Not authorized to respond' using errcode = '42501';
  end if;
  if p_availability is null or p_availability not in ('available', 'unavailable', 'backup') then
    raise exception 'Choose a response' using errcode = '22023';
  end if;
  update public.call_up_players set availability = p_availability, responded_at = now(), updated_at = now()
    where id = v_entry.id returning * into v_entry;
  return v_entry;
end;
$$;

-- Supabase normalmente crea esta publicación vacía. No se amplía a tablas ajenas.
do $$
declare v_table text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    foreach v_table in array array['call_ups', 'call_up_players', 'call_up_trials', 'call_up_aids'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table) then
        execute format('alter publication supabase_realtime add table public.%I', v_table);
      end if;
    end loop;
  end if;
end;
$$;

commit;
