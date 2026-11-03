begin;

-- Google Play identifies a subscription/base-plan pair as productId:basePlanId.
-- Keep the existing canonical product IDs in purchase intents and renewals.
create function private.canonical_club_product(p_product text) returns text
language sql immutable set search_path='' as $$
  select case
    when p_product in ('com.convosquad.premium.monthly','com.convosquad.premium.yearly','com.convosquad.club.activation') then p_product
    when p_product ~ '^com\.convosquad\.premium\.(monthly|yearly):[a-z0-9][a-z0-9-]{0,62}$' then split_part(p_product,':',1)
    else null end;
$$;
revoke all on function private.canonical_club_product(text) from public,anon,authenticated,service_role;

alter function public.begin_club_purchase(uuid,text) rename to begin_club_purchase_before_google_plans;
alter function public.begin_club_purchase_before_google_plans(uuid,text) set schema private;
revoke all on function private.begin_club_purchase_before_google_plans(uuid,text) from public,anon,authenticated,service_role;
create function public.begin_club_purchase(p_club_id uuid,p_product_id text) returns uuid
language plpgsql security definer set search_path='' as $$
declare product text:=private.canonical_club_product(p_product_id);
begin
  if product is null then raise exception 'Unknown product' using errcode='22023'; end if;
  return private.begin_club_purchase_before_google_plans(p_club_id,product);
end;
$$;

alter function public.apply_revenuecat_event(text,text,text,text,text,text,timestamptz) rename to apply_revenuecat_event_before_google_plans;
alter function public.apply_revenuecat_event_before_google_plans(text,text,text,text,text,text,timestamptz) set schema private;
revoke all on function private.apply_revenuecat_event_before_google_plans(text,text,text,text,text,text,timestamptz) from public,anon,authenticated,service_role;
create function public.apply_revenuecat_event(
  p_app_user_id text,p_original_app_user_id text,p_product_id text,
  p_original_transaction_id text,p_store text,p_event_type text,p_expiration_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare product text:=private.canonical_club_product(p_product_id);
begin
  if product is null then return jsonb_build_object('applied',false,'reason','unsupported_product'); end if;
  return private.apply_revenuecat_event_before_google_plans(p_app_user_id,p_original_app_user_id,product,p_original_transaction_id,p_store,p_event_type,p_expiration_at);
end;
$$;
revoke all on function public.begin_club_purchase(uuid,text),public.apply_revenuecat_event(text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.begin_club_purchase(uuid,text) to authenticated;
grant execute on function public.apply_revenuecat_event(text,text,text,text,text,text,timestamptz) to service_role;
notify pgrst,'reload schema';
commit;
