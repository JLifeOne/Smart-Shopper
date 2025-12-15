-- Profiles: support phone-only auth + richer account settings.
-- - Phone-first auth (WhatsApp-style) means email can be absent.
-- - Keep profiles contact info aligned with auth users where possible.

alter table public.profiles
  alter column email drop not null;

alter table public.profiles
  add column if not exists phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_contact_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_contact_check
      check (email is not null or phone is not null)
      not valid;
  end if;
end $$;

