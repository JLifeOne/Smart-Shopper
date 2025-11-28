-- Tests for menu_review_queue migration (0014_menu_review_queue.sql)

do $$
begin
  -- Verify table exists
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_review_queue') then
    raise exception 'menu_review_queue table missing';
  end if;

  -- Verify RLS enabled
  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_review_queue'
      and c.relrowsecurity = true
  ) then
    raise exception 'RLS not enabled for menu_review_queue';
  end if;

  -- Basic column sanity
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'menu_review_queue' and column_name = 'status') then
    raise exception 'menu_review_queue.status missing';
  end if;
end $$;
