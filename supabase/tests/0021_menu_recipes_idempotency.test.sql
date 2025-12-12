select plan(9);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_recipes'
      and column_name = 'idempotency_key'
  ),
  'idempotency_key column present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_recipes'
      and column_name = 'version'
  ),
  'version column present'
);

select ok(
  exists (
    select 1 from pg_indexes
    where indexname = 'menu_recipes_owner_idempotency_idx'
  ),
  'menu_recipes_owner_idempotency_idx present'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_recipes'::regclass
      and conname = 'menu_recipes_version_check'
  ),
  'menu_recipes_version_check constraint present'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_recipes'::regclass
      and conname = 'menu_recipes_idempotency_key_valid'
  ),
  'menu_recipes_idempotency_key_valid constraint present'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'menu_recipes_version_bump'
  ),
  'menu_recipes_version_bump trigger present'
);

with owner as (
  select tests.create_supabase_user('menu-idempotency'::text) as id
),
inserted as (
  insert into public.menu_recipes (owner_id, title, idempotency_key)
  select id, 'Idempotency smoke test', 'menu-idempotency-' || gen_random_uuid()
  from owner
  returning id, version, updated_at
),
updated as (
  update public.menu_recipes
  set title = 'Updated title'
  where id = (select id from inserted)
  returning version, updated_at
)
select * from (
  select ok(inserted.version = 1, 'version seeded to 1 on insert') from inserted
  union all
  select ok(updated.version = 2, 'version increments on update') from updated
  union all
  select ok(updated.updated_at > inserted.updated_at, 'updated_at refreshed on update') from inserted, updated
) as tap_results;
