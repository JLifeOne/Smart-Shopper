-- Profiles: onboarding demographics + location.

alter table public.profiles
  add column if not exists date_of_birth date;

alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  add column if not exists location_city text;

alter table public.profiles
  add column if not exists location_county text;

alter table public.profiles
  add column if not exists location_region text;

alter table public.profiles
  add column if not exists location_postal_code text;

alter table public.profiles
  add column if not exists location_country text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_gender_check
      check (gender in ('male','female','prefer_not_to_say'));
  end if;
end $$;

