select plan(9);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'brands'
  ),
  'brands table exists'
);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'brand_aliases'
  ),
  'brand_aliases table exists'
);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'app_runtime_config'
  ),
  'app_runtime_config table exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'brand_id'
  ),
  'products.brand_id present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'brand_confidence'
  ),
  'products.brand_confidence present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'list_items'
      and column_name = 'brand_remote_id'
  ),
  'list_items.brand_remote_id present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'list_items'
      and column_name = 'brand_confidence'
  ),
  'list_items.brand_confidence present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'price_points'
      and column_name = 'brand_id'
  ),
  'price_points.brand_id present'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'get_runtime_config'
      and pg_function_is_visible(oid)
  ),
  'get_runtime_config function exists'
);

select * from finish();
