-- Helpful indexes for aggregation and consumption patterns

-- Price points: support scans by brand/store/time window
create index if not exists idx_price_points_brand_store_captured
  on public.price_points (brand_id, store_id, captured_at desc);

-- Insights: fast lookups by store/category when filtering UI panels
create index if not exists idx_bpi_store_category
  on public.brand_price_insights (store_id, category);

