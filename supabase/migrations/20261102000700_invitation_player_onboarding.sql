begin;
create function private.ea_id_similarity(a text,b text) returns numeric language plpgsql immutable set search_path='' as $$
declare x text:=lower(regexp_replace(a,'\s','','g')); y text:=lower(regexp_replace(b,'\s','','g')); prev integer[]; curr integer[]; i integer; j integer;
begin
 if x=y then return 1; end if;
 if length(x)=0 or length(y)=0 then return 0; end if;
 prev:=array(select generate_series(0,length(y)));
 for i in 1..length(x) loop
  curr:=array[i];
  for j in 1..length(y) loop
   curr:=array_append(curr,least(curr[j]+1,prev[j+1]+1,prev[j]+case when substr(x,i,1)=substr(y,j,1) then 0 else 1 end));
  end loop;
  prev:=curr;
 end loop;
 return 1-prev[length(y)+1]::numeric/greatest(length(x),length(y));
end; $$;
create table public.player_link_requests(
 club_id uuid not null references public.clubs(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 primary key(club_id,user_id)
);
alter table public.player_link_requests enable row level security;
revoke all on public.player_link_requests from public,anon,authenticated;

create function public.prepare_player_onboarding(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); n text; p public.players; matches integer; suggestions jsonb;
begin
 perform 1 from public.clubs where id=p_club_id for update;
 if not private.is_member(p_club_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into p from public.players where club_id=p_club_id and user_id=u;
 if found then return jsonb_build_object('status','linked','playerId',p.id); end if;
 select username into n from public.profiles where id=u;
 select count(*) into matches from public.players where club_id=p_club_id and is_active and lower(regexp_replace(ea_id,'\s','','g'))=lower(regexp_replace(n,'\s','','g'));
 if matches=1 then
  select * into p from public.players where club_id=p_club_id and is_active and lower(regexp_replace(ea_id,'\s','','g'))=lower(regexp_replace(n,'\s','','g'));
  if p.user_id is not null then return jsonb_build_object('status','blocked'); end if;
  perform private.link_player(p_club_id,p.id,u);
  return jsonb_build_object('status','linked','playerId',p.id);
 end if;
 if exists(select 1 from public.player_link_requests where club_id=p_club_id and user_id=u and status='pending') then return jsonb_build_object('status','pending'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'eaId',ea_id,'nickname',nickname,'jerseyNumber',jersey_number,'score',score) order by score desc),'[]'::jsonb) into suggestions from (
  select id,ea_id,nickname,jersey_number,private.ea_id_similarity(ea_id,n) score from public.players where club_id=p_club_id and is_active and user_id is null
 ) candidates where score>=0.75;
 return jsonb_build_object('status','new','eaId',n,'suggestions',suggestions,'usedNumbers',coalesce((select jsonb_agg(jersey_number) from public.players where club_id=p_club_id and is_active and jersey_number is not null),'[]'::jsonb));
end; $$;

create function public.complete_player_onboarding(p_club_id uuid,p_jersey integer,p_category public.roster_category,p_nickname text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_user(); state jsonb; n text; p public.players;
begin
 state:=public.prepare_player_onboarding(p_club_id);
 if state->>'status'='linked' then return (state->>'playerId')::uuid; end if;
 if state->>'status'<>'new' then raise exception 'La vinculación requiere la revisión de un capitán.' using errcode='22023'; end if;
 if p_jersey is null or p_jersey not between 1 and 99 or p_category is null or p_nickname is null or length(btrim(p_nickname)) not between 1 and 24 then raise exception 'Completa un dorsal, posición y apodo válidos.' using errcode='22023'; end if;
 if exists(select 1 from public.players where club_id=p_club_id and is_active and jersey_number=p_jersey) then raise exception 'Ese dorsal ya está ocupado. Elige otro.' using errcode='23505'; end if;
 select username into n from public.profiles where id=u;
 insert into public.players(club_id,ea_id,jersey_number,category,nickname) values(p_club_id,n,p_jersey,p_category,btrim(p_nickname)) returning * into p;
 perform private.link_player(p_club_id,p.id,u);
 return p.id;
end; $$;
create function public.request_player_link(p_club_id uuid,p_player_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare state jsonb;
begin
 state:=public.prepare_player_onboarding(p_club_id);
 if state->>'status'='linked' then return; end if;
 if state->>'status'<>'new' or not exists(select 1 from jsonb_array_elements(state->'suggestions') s where (s->>'id')::uuid=p_player_id) then raise exception 'Ficha no disponible para vincular.' using errcode='22023'; end if;
 insert into public.player_link_requests(club_id,user_id,player_id) values(p_club_id,auth.uid(),p_player_id)
 on conflict(club_id,user_id) do update set player_id=excluded.player_id,status='pending',created_at=now();
end; $$;
create function public.list_player_link_requests(p_club_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_admin(p_club_id);
 return coalesce((select jsonb_agg(jsonb_build_object('userId',r.user_id,'eaId',a.username,'playerEaId',p.ea_id,'playerId',p.id)) from public.player_link_requests r join public.profiles a on a.id=r.user_id join public.players p on p.id=r.player_id where r.club_id=p_club_id and r.status='pending'),'[]'::jsonb);
end; $$;
create function public.review_player_link(p_club_id uuid,p_user_id uuid,p_approve boolean) returns void
language plpgsql security definer set search_path='' as $$
declare r public.player_link_requests;
begin
 perform 1 from public.clubs where id=p_club_id for update;
 perform private.require_admin(p_club_id);
 if p_approve is null then raise exception 'Decisión inválida' using errcode='22023'; end if;
 select * into r from public.player_link_requests where club_id=p_club_id and user_id=p_user_id and status='pending' for update;
 if not found then raise exception 'Solicitud no disponible' using errcode='22023'; end if;
 if p_approve then
  if not exists(select 1 from public.players where id=r.player_id and club_id=p_club_id and is_active and user_id is null) or exists(select 1 from public.players where club_id=p_club_id and user_id=p_user_id) then raise exception 'La ficha o cuenta ya está vinculada.' using errcode='23505'; end if;
  perform private.link_player(p_club_id,r.player_id,p_user_id);
 end if;
 update public.player_link_requests set status=case when p_approve then 'approved' else 'rejected' end where club_id=p_club_id and user_id=p_user_id;
end; $$;
revoke all on function private.ea_id_similarity(text,text) from public,anon,authenticated;
revoke all on function public.prepare_player_onboarding(uuid),public.complete_player_onboarding(uuid,integer,public.roster_category,text),public.request_player_link(uuid,uuid),public.list_player_link_requests(uuid),public.review_player_link(uuid,uuid,boolean) from public,anon;
grant execute on function public.prepare_player_onboarding(uuid),public.complete_player_onboarding(uuid,integer,public.roster_category,text),public.request_player_link(uuid,uuid),public.list_player_link_requests(uuid),public.review_player_link(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
