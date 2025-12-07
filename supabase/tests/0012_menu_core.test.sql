select plan(6);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_recipes'),
  'menu_recipes table exists'
);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_sessions'),
  'menu_sessions table exists'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'menu_recipes_owner_idx'),
  'menu_recipes_owner_idx present'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'menu_sessions_owner_idx'),
  'menu_sessions_owner_idx present'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_recipes'
      and c.relrowsecurity = true
  ),
  'RLS enabled for menu_recipes'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_sessions'
      and c.relrowsecurity = true
  ),
  'RLS enabled for menu_sessions'
);
