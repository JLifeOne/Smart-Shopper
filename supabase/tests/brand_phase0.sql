-- Fails if core Phase 0 objects are not present or are missing required columns.

do $$
begin
  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'brands'
  ) then
    raise exception 'brands table missing';
  end if;

  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'brand_aliases'
  ) then
    raise exception 'brand_aliases table missing';
  end if;

  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'app_runtime_config'
  ) then
    raise exception 'app_runtime_config table missing';
  end if;
end;
$$;

-- Verify new columns on products, list_items, price_snapshots.
do $$
begin
  perform 1 from information_schema.columns
   where table_schema = 'public'
     and table_name = 'products'
     and column_name = 'brand_id';
  if not found then
    raise exception 'products.brand_id missing';
  end if;

  perform 1 from information_schema.columns
   where table_schema = 'public'
     and table_name = 'products'
     and column_name = 'brand_confidence';
  if not found then
    raise exception 'products.brand_confidence missing';
  end if;

  perform 1 from information_schema.columns
   where table_schema = 'public'
     and table_name = 'list_items'
     and column_name = 'brand_remote_id';
  if not found then
    raise exception 'list_items.brand_remote_id missing';
  end if;

  perform 1 from information_schema.columns
   where table_schema = 'public'
     and table_name = 'price_points'
     and column_name = 'brand_id';
  if not found then
    raise exception 'price_points.brand_id missing';
  end if;
end;
$$;

-- Ensure runtime config helper exists.
do $$
begin
  perform 1
  from pg_proc
  where proname = 'get_runtime_config'
    and pg_function_is_visible(oid);
  if not found then
    raise exception 'get_runtime_config function missing';
  end if;
end;
$$;

