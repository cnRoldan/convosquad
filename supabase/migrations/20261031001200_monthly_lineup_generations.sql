begin;
create or replace function public.read_lineup_access(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups; v_activated boolean; v_premium boolean; v_used integer; v_month_start timestamptz;
begin
  select * into c from public.call_ups where id=p_call_id;
  if not found or not private.is_member(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  v_month_start:=date_trunc('month',clock_timestamp() at time zone c.timezone) at time zone c.timezone;
  select exists(select 1 from public.club_lineup_accesses where call_up_id=c.id),private.has_lineup_premium(c.club_id),count(*) filter(where activated_at>=v_month_start)::integer
    into v_activated,v_premium,v_used from public.club_lineup_accesses where club_id=c.club_id;
  return jsonb_build_object('activated',coalesce(v_activated,false),'premium',coalesce(v_premium,false),'remaining',greatest(0,6-coalesce(v_used,0)),'allowed',coalesce(v_activated,false) or coalesce(v_premium,false));
end;
$$;

create or replace function public.activate_lineup_access(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups; v_premium boolean; v_used integer; v_exists boolean; v_month_start timestamptz;
begin
  select * into c from public.call_ups where id=p_call_id;
  if not found then raise exception 'Call-up not found' using errcode='22023'; end if;
  perform private.require_admin(c.club_id); perform 1 from public.clubs where id=c.club_id for update;
  select * into c from public.call_ups where id=p_call_id for update;
  if c.status not in ('open','closed') or c.ends_at<=clock_timestamp() then raise exception 'Call-up ended' using errcode='42501'; end if;
  v_month_start:=date_trunc('month',clock_timestamp() at time zone c.timezone) at time zone c.timezone;
  select exists(select 1 from public.club_lineup_accesses where call_up_id=c.id) into v_exists;
  v_premium:=private.has_lineup_premium(c.club_id);
  select count(*)::integer into v_used from public.club_lineup_accesses where club_id=c.club_id and activated_at>=v_month_start;
  if not v_exists and not v_premium and v_used<6 then
    insert into public.club_lineup_accesses(call_up_id,club_id,activated_by) values(c.id,c.club_id,auth.uid()); v_exists:=true; v_used:=v_used+1;
  end if;
  return jsonb_build_object('activated',v_exists,'premium',v_premium,'remaining',greatest(0,6-v_used),'allowed',v_exists or v_premium);
end;
$$;
notify pgrst,'reload schema';
commit;
