begin;

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

-- setup: create a premium auth user so recipe inserts/updates are permitted when menu_recipes is premium-gated
select tests.create_supabase_user(
  'menu-idempotency'::text,
  jsonb_build_object('is_menu_premium', true)
) as owner_id \gset

insert into public.menu_recipes (owner_id, title, idempotency_key)
values (:'owner_id'::uuid, 'Idempotency smoke test', 'menu-idempotency-' || gen_random_uuid())
returning
  id as recipe_id,
  version as insert_version,
  updated_at as insert_updated_at
\gset

select ok(:'insert_version'::int = 1, 'version seeded to 1 on insert');

update public.menu_recipes
set title = 'Updated title'
where id = :'recipe_id'::uuid
returning
  version as update_version,
  updated_at as update_updated_at
\gset

select ok(:'update_version'::int = 2, 'version increments on update');
select ok(
  :'update_updated_at'::timestamptz > :'insert_updated_at'::timestamptz,
  'updated_at refreshed on update'
);

select finish();
rollback;
