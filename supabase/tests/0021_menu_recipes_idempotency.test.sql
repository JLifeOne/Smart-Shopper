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

do $$
declare
  v_owner uuid;
  v_recipe uuid;
  v_version integer;
  v_updated_at timestamptz;
  v_updated_at_2 timestamptz;
  v_idempotency_key text := 'menu-idempotency-key-' || gen_random_uuid();
begin
  select id into v_owner from auth.users limit 1;
  if v_owner is null then
    insert into auth.users (id, email)
    values (gen_random_uuid(), 'menu-idempotency@example.com')
    returning id into v_owner;
  end if;

  insert into public.menu_recipes (owner_id, title, idempotency_key)
  values (v_owner, 'Idempotency smoke test', v_idempotency_key)
  returning id, version, updated_at into v_recipe, v_version, v_updated_at;

  perform ok(v_version = 1, 'version seeded to 1 on insert');

  update public.menu_recipes
    set title = 'Updated title'
  where id = v_recipe
  returning version, updated_at into v_version, v_updated_at_2;

  perform ok(v_version = 2, 'version increments on update');
  perform ok(v_updated_at_2 > v_updated_at, 'updated_at refreshed on update');
end $$;
