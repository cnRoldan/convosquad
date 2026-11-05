begin;

-- Keep the existing activation and history checks behind an explicit captain gate.
alter function public.read_lineup(uuid) rename to read_lineup_before_captain_gate;
alter function public.read_lineup_before_captain_gate(uuid) set schema private;
revoke all on function private.read_lineup_before_captain_gate(uuid) from public,anon,authenticated,service_role;
create function public.read_lineup(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare club uuid;
begin
 select club_id into club from public.call_ups where id=p_call_id;
 perform private.require_admin(club);
 return private.read_lineup_before_captain_gate(p_call_id);
end; $$;

alter function public.read_lineup_access(uuid) rename to read_lineup_access_before_captain_gate;
alter function public.read_lineup_access_before_captain_gate(uuid) set schema private;
revoke all on function private.read_lineup_access_before_captain_gate(uuid) from public,anon,authenticated,service_role;
create function public.read_lineup_access(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare club uuid;
begin
 select club_id into club from public.call_ups where id=p_call_id;
 perform private.require_admin(club);
 return private.read_lineup_access_before_captain_gate(p_call_id);
end; $$;
revoke all on function public.read_lineup(uuid),public.read_lineup_access(uuid) from public,anon;
grant execute on function public.read_lineup(uuid),public.read_lineup_access(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
