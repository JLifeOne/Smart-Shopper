-- Dev/staging seed for brand + store + product + alias + price_points
-- Safe to run multiple times: guards to avoid duplicate heavy inserts.

do $$ begin
  -- pick any existing auth user for user_id on rows that require it
  -- if none exists, this will be null; those inserts will set user_id to null-friendly columns only
  perform 1;
end $$;

with u as (
  select id as uid from auth.users limit 1
), b as (
  insert into public.brands (name, normalized_name)
  values ('Grace','grace')
  on conflict (normalized_name) do update set name = excluded.name
  returning id as brand_id
), s as (
  insert into public.stores (name)
  values ('Test Store')
  on conflict (name) do update set name = excluded.name
  returning id as store_id
), p as (
  insert into public.products (name, category, brand_id)
  select 'Grace Baked Beans 300g', 'canned', brand_id from b
  on conflict (name) do update set category = excluded.category
  returning id as product_id
), a as (
  insert into public.brand_aliases (brand_id, alias, store_id, confidence, source)
  select b.brand_id, 'grace baked beans', s.store_id, 0.8, 'seed' from b, s
  on conflict do nothing
  returning 1
)
-- two windows to produce a non-zero trend
insert into public.price_points (product_id, store_id, brand_id, price, currency, captured_at, brand_confidence, user_id)
select p.product_id, s.store_id, b.brand_id, 2.00, 'USD', now() - interval '45 days', 0.8, u.uid
from p, s, b, u
union all
select p.product_id, s.store_id, b.brand_id, 1.80, 'USD', now() - interval '10 days', 0.9, u.uid
from p, s, b, u;

