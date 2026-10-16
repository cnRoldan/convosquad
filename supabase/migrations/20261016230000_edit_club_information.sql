begin;

create or replace function private.validate_club_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

commit;
