-- Cleanup DEV seed artifacts. Safe to run in any env.
do $$
declare
  v_brand uuid;
  v_store uuid;
  v_product uuid;
begin
  select id into v_brand from public.brands where normalized_name = 'grace' limit 1;
  select id into v_store from public.stores where name = 'Test Store' limit 1;
  select id into v_product from public.products where name = 'Grace Baked Beans 300g' limit 1;

  -- Remove seed price points first
  if v_store is not null and v_brand is not null then
    delete from public.price_points
    where store_id = v_store and brand_id = v_brand and source = 'user';
  end if;

  -- Remove the seed alias (generic)
  if v_brand is not null then
    delete from public.brand_aliases where brand_id = v_brand and alias = 'grace baked beans' and (store_id is null or store_id = v_store) and source = 'seed';
  end if;

  -- Remove the seed product if no remaining references
  if v_product is not null and not exists (select 1 from public.price_points where product_id = v_product) then
    delete from public.products where id = v_product;
  end if;

  -- Optionally remove test store if no price points remain
  if v_store is not null and not exists (select 1 from public.price_points where store_id = v_store) then
    delete from public.stores where id = v_store;
  end if;
end $$;

