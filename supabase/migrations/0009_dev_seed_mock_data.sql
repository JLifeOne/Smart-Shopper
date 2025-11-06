-- DEV ONLY: seed minimal brand/store/product/alias/price_points for testing
-- Safe/idempotent. Remove before production cutover if undesired.

do $$
declare
  v_uid uuid;
  v_brand uuid;
  v_store uuid;
  v_product uuid;
begin
  select id into v_uid from auth.users limit 1;

  select id into v_brand from public.brands where normalized_name = 'grace' limit 1;
  if v_brand is null then
    insert into public.brands (name, normalized_name)
    values ('Grace','grace') returning id into v_brand;
  end if;

  select id into v_store from public.stores where name = 'Test Store' limit 1;
  if v_store is null then
    insert into public.stores (name) values ('Test Store') returning id into v_store;
  end if;

  select id into v_product from public.products where name = 'Grace Baked Beans 300g' limit 1;
  if v_product is null then
    insert into public.products (name, category, brand_id, size_value, size_unit)
    values ('Grace Baked Beans 300g', 'canned', v_brand, 300, 'g') returning id into v_product;
  end if;

  -- alias ensure
  if not exists (
    select 1 from public.brand_aliases x where x.brand_id = v_brand and x.alias = 'grace baked beans' and x.store_id = v_store
  ) then
    insert into public.brand_aliases (brand_id, alias, store_id, confidence, source)
    values (v_brand, 'grace baked beans', v_store, 0.8, 'seed');
  end if;

  -- price points only if we have a user id to satisfy FK
  if v_uid is not null then
    insert into public.price_points (product_id, store_id, brand_id, price, currency, size_value, size_unit, source, captured_at, brand_confidence, user_id)
    values
      (v_product, v_store, v_brand, 2.00, 'USD', 300, 'g', 'user', now() - interval '45 days', 0.8, v_uid),
      (v_product, v_store, v_brand, 1.80, 'USD', 300, 'g', 'user', now() - interval '10 days', 0.9, v_uid);
  end if;
end $$;
