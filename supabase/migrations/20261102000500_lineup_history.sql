begin;
alter table public.call_up_lineups add column historical_snapshot jsonb;

create function private.capture_lineup_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare club public.clubs; kit public.club_lineup_preferences; people jsonb;
begin
 if new.published is null then return new; end if;
 if tg_op='UPDATE' and new.published is not distinct from old.published and old.historical_snapshot is not null then return new; end if;
 select * into club from public.clubs where id=new.club_id;
 select * into kit from public.club_lineup_preferences where club_id=new.club_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'jerseyNumber',number,'active',true,'eligible',true)),'[]'::jsonb) into people from (
   select p.id::text id,coalesce(nullif(p.nickname,''),p.ea_id) name,p.jersey_number number from public.players p where p.club_id=new.club_id
   union all select g.id::text,g.name,null::integer from public.lineup_guests g where g.club_id=new.club_id
 ) candidates where id in (
   select value->>'playerId' from jsonb_array_elements(new.published->'slots')
   union select jsonb_array_elements_text(new.published->'bench')
 );
 new.historical_snapshot:=jsonb_build_object('clubName',club.name,'crestPath',club.crest_path,'lineup',new.published,'candidates',people,
   'shirtColor',coalesce(kit.player_color,'#B4F16C'),'numberColor',coalesce(kit.jersey_color,'#0B1210'),'goalkeeperColor',coalesce(kit.goalkeeper_color,'#F4A83A'),'templateVersion',1);
 return new;
end;
$$;
create trigger capture_lineup_history before insert or update of published on public.call_up_lineups
for each row execute function private.capture_lineup_history();
-- Preserve existing published lineups as well, using the information available today.
update public.call_up_lineups set published=published where published is not null;

create function public.read_historical_lineup(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where id=p_call_id;
 perform private.require_admin(c.club_id);
 if c.ends_at>clock_timestamp() then raise exception 'Call-up has not ended' using errcode='22023'; end if;
 if not private.has_club_premium(c.club_id) then return jsonb_build_object('allowed',false); end if;
 return jsonb_build_object('allowed',true,'snapshot',(select historical_snapshot from public.call_up_lineups where call_up_id=c.id));
end;
$$;

-- Protect older read paths too: historical data cannot bypass the paywall.
alter function public.read_lineup(uuid) rename to read_lineup_before_history;
alter function public.read_lineup_before_history(uuid) set schema private;
revoke all on function private.read_lineup_before_history(uuid) from public,anon,authenticated;
create function public.read_lineup(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where id=p_call_id;
 if not found or not private.is_member(c.club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if c.ends_at<=clock_timestamp() then
   if not private.has_club_premium(c.club_id) then raise exception 'Historical lineups require Premium' using errcode='42501'; end if;
   return jsonb_build_object('revision',0,'inherited',false,'document',(select published from public.call_up_lineups where call_up_id=c.id));
 end if;
 return private.read_lineup_before_history(p_call_id);
end;
$$;
alter function public.list_lineup_drafts(uuid) rename to list_lineup_drafts_before_history;
alter function public.list_lineup_drafts_before_history(uuid) set schema private;
revoke all on function private.list_lineup_drafts_before_history(uuid) from public,anon,authenticated;
create function public.list_lineup_drafts(p_call_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.call_ups;
begin
 select * into c from public.call_ups where id=p_call_id;
 perform private.require_admin(c.club_id);
 if c.ends_at<=clock_timestamp() and not private.has_club_premium(c.club_id) then raise exception 'Historical lineups require Premium' using errcode='42501'; end if;
 return private.list_lineup_drafts_before_history(p_call_id);
end;
$$;
revoke all on function private.capture_lineup_history() from public,anon,authenticated;
revoke all on function public.read_historical_lineup(uuid),public.read_lineup(uuid),public.list_lineup_drafts(uuid) from public,anon;
grant execute on function public.read_historical_lineup(uuid),public.read_lineup(uuid),public.list_lineup_drafts(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
