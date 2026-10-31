begin;
alter table public.players add column nickname text check(nickname is null or char_length(btrim(nickname)) between 1 and 24);
grant update(nickname) on public.players to authenticated;
notify pgrst,'reload schema';
commit;
