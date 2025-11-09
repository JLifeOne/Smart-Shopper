select plan(2);

select lives_ok($$select public.refresh_brand_price_insights();$$, 'refresh_brand_price_insights runs');

select ok(
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'brand_price_insights'
  ),
  'brand_price_insights table exists'
);

select * from finish();
