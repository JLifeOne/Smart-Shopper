-- Tests for menu schema migration (0011_menu_core.sql)

do $$
begin
  -- Verify tables exist
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_recipes') then
    raise exception 'menu_recipes table missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_sessions') then
    raise exception 'menu_sessions table missing';
  end if;

  -- Verify key indexes
  if not exists (select 1 from pg_indexes where indexname = 'menu_recipes_owner_idx') then
    raise exception 'menu_recipes_owner_idx missing';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'menu_sessions_owner_idx') then
    raise exception 'menu_sessions_owner_idx missing';
  end if;

  -- Verify RLS enforced
  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_recipes'
      and c.relrowsecurity = true
  ) then
    raise exception 'RLS not enabled for menu_recipes';
  end if;
  if not exists (
    select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'menu_sessions'
      and c.relrowsecurity = true
  ) then
    raise exception 'RLS not enabled for menu_sessions';
  end if;
end $$;
