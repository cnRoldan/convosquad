begin;

create table public.club_lineup_preferences (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  custom_formation text not null check (custom_formation in ('4-3-3','4-4-2','4-2-3-1','3-5-2')),
  custom_slots jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.club_lineup_preferences enable row level security;
revoke all on public.club_lineup_preferences from public, anon, authenticated;

create function public.read_lineup_preference(p_club_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_preference public.club_lineup_preferences;
begin
  if p_club_id is null or not private.is_member(p_club_id) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  select * into v_preference from public.club_lineup_preferences where club_id=p_club_id;
  if not found then return '{}'::jsonb; end if;
  return jsonb_build_object('formation', v_preference.custom_formation, 'slots', v_preference.custom_slots);
end;
$$;

create function public.save_lineup_preference(p_club_id uuid, p_formation text, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;
begin
  perform private.require_admin(p_club_id);
  if p_formation is null or p_formation not in ('4-3-3','4-4-2','4-2-3-1','3-5-2')
    or p_slots is null or jsonb_typeof(p_slots)<>'array' or jsonb_array_length(p_slots)<>11 then
    raise exception 'Invalid lineup preference' using errcode='22023';
  end if;
  for s in select value from jsonb_array_elements(p_slots) loop
    if jsonb_typeof(s->'id') is distinct from 'number' or jsonb_typeof(s->'x') is distinct from 'number' or jsonb_typeof(s->'y') is distinct from 'number'
      or (s->>'id')::integer not between 0 and 10 or (s->>'x')::numeric not between 0.08 and 0.92 or (s->>'y')::numeric not between 0.08 and 0.92
      or ((s->>'id')::integer=0 and ((s->>'x')::numeric<>0.5 or (s->>'y')::numeric<>0.9)) then
      raise exception 'Invalid lineup preference' using errcode='22023';
    end if;
  end loop;
  if (select count(distinct (value->>'id')::integer) from jsonb_array_elements(p_slots))<>11 then
    raise exception 'Invalid lineup preference' using errcode='22023';
  end if;
  insert into public.club_lineup_preferences(club_id,custom_formation,custom_slots)
  values(p_club_id,p_formation,p_slots)
  on conflict(club_id) do update set custom_formation=excluded.custom_formation,custom_slots=excluded.custom_slots,updated_at=now();
  return jsonb_build_object('formation', p_formation, 'slots', p_slots);
end;
$$;

revoke all on function public.read_lineup_preference(uuid), public.save_lineup_preference(uuid,text,jsonb) from public, anon;
grant execute on function public.read_lineup_preference(uuid), public.save_lineup_preference(uuid,text,jsonb) to authenticated;

commit;
