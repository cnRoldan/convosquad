begin;

create type public.club_billing_kind as enum ('premium', 'activation');

-- A captain creates an intent immediately before opening the native store.
-- RevenueCat identifies the purchaser, while this short-lived record tells us
-- which club the purchase belongs to.
create table public.club_purchase_intents (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.club_billing_kind not null,
  product_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '2 hours',
  completed_at timestamptz
);
create index club_purchase_intents_pending_idx on public.club_purchase_intents(user_id, product_id, expires_at desc) where completed_at is null;
alter table public.club_purchase_intents enable row level security;
revoke all on public.club_purchase_intents from public, anon, authenticated;

-- Keep the store transaction mapped to the club. Renewals then continue to
-- update the same club even though they happen without a purchase intent.
create table public.club_store_purchases (
  store text not null,
  original_transaction_id text not null,
  club_id uuid not null references public.clubs(id) on delete cascade,
  purchaser_user_id uuid not null references public.profiles(id) on delete restrict,
  kind public.club_billing_kind not null,
  product_id text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_event_at timestamptz not null default clock_timestamp(),
  primary key (store, original_transaction_id)
);
create index club_store_purchases_club_idx on public.club_store_purchases(club_id, kind);
alter table public.club_store_purchases enable row level security;
revoke all on public.club_store_purchases from public, anon, authenticated;

create function public.begin_club_purchase(p_club_id uuid, p_product_id text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_kind public.club_billing_kind; v_id uuid;
begin
  perform 1 from public.clubs where id=p_club_id for update;
  perform private.require_admin(p_club_id);
  v_kind:=case p_product_id
    when 'com.convosquad.premium.monthly' then 'premium'::public.club_billing_kind
    when 'com.convosquad.premium.yearly' then 'premium'::public.club_billing_kind
    when 'com.convosquad.club.activation' then 'activation'::public.club_billing_kind
    else null end;
  if v_kind is null then raise exception 'Unknown product' using errcode='22023'; end if;
  delete from public.club_purchase_intents where user_id=auth.uid() and expires_at<clock_timestamp();
  insert into public.club_purchase_intents(club_id,user_id,kind,product_id)
  values(p_club_id,auth.uid(),v_kind,p_product_id) returning id into v_id;
  return v_id;
end;
$$;

create function public.apply_revenuecat_event(
  p_app_user_id text, p_original_app_user_id text, p_product_id text,
  p_original_transaction_id text, p_store text, p_event_type text,
  p_expiration_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_kind public.club_billing_kind; v_user uuid; v_purchase public.club_store_purchases;
  v_intent public.club_purchase_intents; v_until timestamptz;
begin
  v_kind:=case p_product_id
    when 'com.convosquad.premium.monthly' then 'premium'::public.club_billing_kind
    when 'com.convosquad.premium.yearly' then 'premium'::public.club_billing_kind
    when 'com.convosquad.club.activation' then 'activation'::public.club_billing_kind
    else null end;
  if v_kind is null or nullif(p_original_transaction_id,'') is null then return jsonb_build_object('applied',false,'reason','unsupported_product'); end if;

  select * into v_purchase from public.club_store_purchases
    where store=coalesce(nullif(p_store,''),'UNKNOWN') and original_transaction_id=p_original_transaction_id for update;
  if not found then
    begin v_user:=coalesce(nullif(p_original_app_user_id,''),nullif(p_app_user_id,''))::uuid;
    exception when invalid_text_representation then return jsonb_build_object('applied',false,'reason','unknown_customer'); end;
    select * into v_intent from public.club_purchase_intents
      where user_id=v_user and product_id=p_product_id and completed_at is null and expires_at>=clock_timestamp()
      order by created_at desc limit 1 for update;
    if not found then return jsonb_build_object('applied',false,'reason','missing_purchase_intent'); end if;
    insert into public.club_store_purchases(store,original_transaction_id,club_id,purchaser_user_id,kind,product_id,expires_at,last_event_at)
    values(coalesce(nullif(p_store,''),'UNKNOWN'),p_original_transaction_id,v_intent.club_id,v_user,v_kind,p_product_id,p_expiration_at,clock_timestamp())
    returning * into v_purchase;
    update public.club_purchase_intents set completed_at=clock_timestamp() where id=v_intent.id;
  else
    update public.club_store_purchases set product_id=p_product_id, expires_at=coalesce(p_expiration_at,expires_at), last_event_at=clock_timestamp()
      where store=v_purchase.store and original_transaction_id=v_purchase.original_transaction_id returning * into v_purchase;
  end if;

  if p_event_type in ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE','UNCANCELLATION','TEMPORARY_ENTITLEMENT_GRANT') then
    if v_purchase.kind='activation' then
      insert into public.club_feature_entitlements(club_id,club_activated_at,updated_at) values(v_purchase.club_id,clock_timestamp(),clock_timestamp())
      on conflict(club_id) do update set club_activated_at=coalesce(club_feature_entitlements.club_activated_at,excluded.club_activated_at),updated_at=clock_timestamp();
    elsif p_expiration_at is not null then
      insert into public.club_feature_entitlements(club_id,lineup_premium_until,updated_at) values(v_purchase.club_id,p_expiration_at,clock_timestamp())
      on conflict(club_id) do update set lineup_premium_until=greatest(coalesce(club_feature_entitlements.lineup_premium_until,'epoch'::timestamptz),excluded.lineup_premium_until),updated_at=clock_timestamp();
    end if;
  elsif p_event_type in ('EXPIRATION','REFUND') then
    update public.club_store_purchases set revoked_at=clock_timestamp(),last_event_at=clock_timestamp()
      where store=v_purchase.store and original_transaction_id=v_purchase.original_transaction_id;
    if v_purchase.kind='premium' then
      select max(expires_at) into v_until from public.club_store_purchases
        where club_id=v_purchase.club_id and kind='premium' and revoked_at is null and expires_at>clock_timestamp();
      update public.club_feature_entitlements set lineup_premium_until=v_until,updated_at=clock_timestamp() where club_id=v_purchase.club_id;
    elsif p_event_type='REFUND' then
      update public.club_feature_entitlements set club_activated_at=null,updated_at=clock_timestamp()
        where club_id=v_purchase.club_id and not exists(select 1 from public.club_store_purchases where club_id=v_purchase.club_id and kind='activation' and revoked_at is null);
    end if;
  end if;
  return jsonb_build_object('applied',true,'clubId',v_purchase.club_id,'kind',v_purchase.kind);
end;
$$;

revoke all on function public.begin_club_purchase(uuid,text), public.apply_revenuecat_event(text,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.begin_club_purchase(uuid,text) to authenticated;
grant execute on function public.apply_revenuecat_event(text,text,text,text,text,text,timestamptz) to service_role;
commit;
