begin;

-- profiles.username conserva el identificador público; las cuentas anteriores no se modifican.
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username ~ '^[A-Za-z0-9_-]{3,24}$');

-- El identificador de acceso no puede cambiar de forma independiente a Supabase Auth.
revoke update (username) on public.profiles from authenticated;

create function public.is_ea_id_available(p_ea_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(btrim(p_ea_id) ~ '^[A-Za-z0-9_-]{3,24}$', false)
    and not exists (
      select 1 from public.profiles where lower(username) = lower(btrim(p_ea_id))
    );
$$;
revoke all on function public.is_ea_id_available(text) from public;
grant execute on function public.is_ea_id_available(text) to anon, authenticated;

commit;
