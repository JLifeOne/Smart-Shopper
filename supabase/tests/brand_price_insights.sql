select public.refresh_brand_price_insights();

-- ensure table is accessible even when empty
select 1 where exists (
  select 1 from information_schema.tables
  where table_schema = 'public'
    and table_name = 'brand_price_insights'
);
