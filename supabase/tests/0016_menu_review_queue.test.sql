select plan(3);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_review_queue'),
  'menu_review_queue table exists'
);

select ok(
  exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_review_queue'
      and c.relrowsecurity = true
  ),
  'RLS enabled for menu_review_queue'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_review_queue'
      and column_name = 'status'
  ),
  'menu_review_queue.status column present'
);
