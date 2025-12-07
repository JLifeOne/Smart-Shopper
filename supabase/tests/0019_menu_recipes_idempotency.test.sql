-- Tests for menu_recipes idempotency and optimistic locking (0019_menu_recipes_idempotency.sql)

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_recipes'
      and column_name = 'idempotency_key'
  ) then
    raise exception 'idempotency_key missing on menu_recipes';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_recipes'
      and column_name = 'version'
  ) then
    raise exception 'version column missing on menu_recipes';
  end if;

  if not exists (
    select 1 from pg_indexes
    where indexname = 'menu_recipes_owner_idempotency_idx'
  ) then
    raise exception 'menu_recipes_owner_idempotency_idx missing';
  end if;
end $$;
