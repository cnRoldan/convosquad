begin;

-- The public login name and the synthetic Auth email must change atomically.
-- No user-id argument: a captain cannot rename another member's login.
create or replace function public.change_my_ea_id(p_current_ea_id text,p_new_ea_id text)
returns text language plpgsql security definer set search_path='' as $$
declare
  u uuid := private.require_user();
  old_name text;
  new_name text := btrim(p_new_ea_id);
  old_email text;
  new_email text;
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb);
begin
  if new_name is null or new_name !~ '^[A-Za-z0-9_-]{3,24}$' then
    raise exception 'Invalid EA ID' using errcode='P4101';
  end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) m
    where m->>'method'='password' and case when m->>'timestamp' ~ '^[0-9]+([.][0-9]+)?$'
      then (m->>'timestamp')::numeric between extract(epoch from clock_timestamp()-interval '5 minutes')
        and extract(epoch from clock_timestamp()+interval '30 seconds') else false end) then
    raise exception 'Recent password authentication required' using errcode='P4103';
  end if;
  select email into old_email from auth.users where id=u for update;
  select username into old_name from public.profiles where id=u for update;
  if old_name is null or p_current_ea_id is null or lower(btrim(p_current_ea_id))<>lower(old_name) then
    raise exception 'Login name changed; reload your account' using errcode='P4104';
  end if;
  -- Real-email/SSO accounts must keep their existing authentication mechanism.
  if old_email is distinct from 'ea.'||lower(old_name)||'@accounts.convosquad.invalid'
    or not exists(select 1 from auth.identities where user_id=u and provider='email') then
    raise exception 'EA ID login is not available for this account' using errcode='P4105';
  end if;
  if new_name=old_name then return old_name; end if;
  new_email := 'ea.'||lower(new_name)||'@accounts.convosquad.invalid';
  if exists(select 1 from public.profiles where id<>u and lower(username)=lower(new_name))
    or exists(select 1 from auth.users where id<>u and lower(email)=new_email) then
    raise exception 'EA ID already registered' using errcode='P4102';
  end if;
  update auth.users set email=new_email,
    email_change='',email_change_token_new='',email_change_token_current='',
    email_change_confirm_status=0,email_change_sent_at=null,
    raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',new_name),
    updated_at=now() where id=u;
  update auth.identities set identity_data=jsonb_set(identity_data,'{email}',to_jsonb(new_email)),
    updated_at=now() where user_id=u and provider='email';
  update public.profiles set username=new_name where id=u;
  -- Player names belong to the club; historical snapshots and all UUID links stay unchanged.
  return new_name;
exception when unique_violation then
  raise exception 'EA ID already registered' using errcode='P4102';
end;
$$;
revoke all on function public.change_my_ea_id(text,text) from public,anon;
grant execute on function public.change_my_ea_id(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
