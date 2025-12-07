-- Idempotency metadata and optimistic locking for menu_recipes

alter table public.menu_recipes
  add column if not exists idempotency_key text,
  add column if not exists version integer not null default 1;

create unique index if not exists menu_recipes_owner_idempotency_idx
  on public.menu_recipes (owner_id, idempotency_key)
  where idempotency_key is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_recipes'::regclass
      and conname = 'menu_recipes_version_check'
  ) then
    alter table public.menu_recipes
      add constraint menu_recipes_version_check check (version >= 1);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_recipes'::regclass
      and conname = 'menu_recipes_idempotency_key_valid'
  ) then
    alter table public.menu_recipes
      add constraint menu_recipes_idempotency_key_valid
        check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 255);
  end if;
end $$;

create or replace function public.menu_recipes_bump_version()
returns trigger as $$
begin
  new.idempotency_key := nullif(btrim(new.idempotency_key), '');

  if tg_op = 'INSERT' then
    new.version := coalesce(new.version, 1);
    new.updated_at := coalesce(new.updated_at, timezone('utc', now()));
    return new;
  end if;

  new.updated_at := timezone('utc', now());
  if new.updated_at <= coalesce(old.updated_at, '-infinity') then
    new.updated_at := old.updated_at + interval '1 millisecond';
  end if;

  new.version := (coalesce(old.version, 0) + 1);

  return new;
end;
$$ language plpgsql;

drop trigger if exists menu_recipes_version_bump on public.menu_recipes;
create trigger menu_recipes_version_bump
before insert or update on public.menu_recipes
for each row execute function public.menu_recipes_bump_version();
