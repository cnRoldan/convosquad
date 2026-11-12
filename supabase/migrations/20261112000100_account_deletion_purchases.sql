begin;

-- Deleting an account must not be blocked by its purchase history. Retain the
-- transaction-to-club mapping for renewals/refunds, without the deleted profile.
alter table public.club_store_purchases
  drop constraint club_store_purchases_purchaser_user_id_fkey,
  alter column purchaser_user_id drop not null,
  add constraint club_store_purchases_purchaser_user_id_fkey
    foreign key (purchaser_user_id) references public.profiles(id) on delete set null;

notify pgrst, 'reload schema';
commit;
