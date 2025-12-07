-- Extend price_points with pack metadata for effective price calculations
alter table if exists public.price_points
  add column if not exists packaging text,
  add column if not exists variant text,
  add column if not exists pack_qty numeric default 1,
  add column if not exists pack_size numeric,
  add column if not exists pack_unit text,
  add column if not exists prepared_yield_value numeric,
  add column if not exists prepared_yield_unit text,
  add column if not exists usable_yield_pct numeric default 1,
  add column if not exists loyalty_savings numeric default 0,
  add column if not exists deposit_fee numeric default 0,
  add column if not exists bundle_size integer,
  add column if not exists bundle_price numeric;

create table if not exists public.product_price_tiers (
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  brand_id uuid references public.brands(id) on delete set null,
  brand_name text,
  store_id uuid references public.stores(id) on delete set null,
  store_name text,
  packaging text not null default 'unspecified',
  variant text not null default 'default',
  tier text not null check (tier in ('lowest','mid','highest')),
  unit_price numeric,
  effective_unit_price numeric not null,
  delta_pct numeric,
  sample_count integer not null,
  confidence numeric,
  currency text,
  last_sample_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (product_id, store_id, packaging, variant)
);

create index if not exists product_price_tiers_product_idx on public.product_price_tiers(product_id);
create index if not exists product_price_tiers_store_idx on public.product_price_tiers(store_id);

create or replace function public.refresh_product_price_tiers()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.product_price_tiers where true;

  with enriched as (
    select
      pp.product_id,
      p.name as product_name,
      coalesce(pp.brand_id, p.brand_id) as brand_id,
      b.name as brand_name,
      pp.store_id,
      s.name as store_name,
      coalesce(nullif(pp.packaging, ''), 'unspecified') as packaging,
      coalesce(nullif(pp.variant, ''), 'default') as variant,
      pp.price,
      coalesce(pp.bundle_price, pp.price) + coalesce(pp.deposit_fee, 0) - coalesce(pp.loyalty_savings, 0) as effective_price,
      pp.currency,
      pp.captured_at,
      coalesce(pp.brand_confidence, 0.5) as confidence,
      coalesce(pp.usable_yield_pct, 1) as usable_yield_pct,
      coalesce(
        pp.prepared_yield_value,
        case
          when pp.pack_qty is not null and pp.pack_size is not null then pp.pack_qty * pp.pack_size
          else pp.size_value
        end
      ) as base_units
    from public.price_points pp
      join public.products p on p.id = pp.product_id
      left join public.brands b on b.id = coalesce(pp.brand_id, p.brand_id)
      left join public.stores s on s.id = pp.store_id
    where
      pp.price is not null
      and pp.captured_at >= now() - interval '90 days'
  ),
  with_units as (
    select
      product_id,
      product_name,
      brand_id,
      brand_name,
      store_id,
      store_name,
      packaging,
      variant,
      price,
      effective_price,
      currency,
      captured_at,
      confidence,
      case
        when base_units is not null and base_units * usable_yield_pct > 0
          then (base_units * usable_yield_pct)
        else null
      end as effective_units
    from enriched
  ),
  filtered as (
    select *,
      case when effective_units is not null and effective_units > 0
        then effective_price / effective_units
        else null end as effective_unit_price
    from with_units
    where effective_price is not null
  ),
  combos as (
    select
      product_id,
      product_name,
      brand_id,
      brand_name,
      store_id,
      store_name,
      packaging,
      variant,
      avg(price) as avg_unit_price,
      avg(effective_unit_price) as effective_unit_price,
      count(*) as sample_count,
      max(currency) as currency,
      max(captured_at) as last_sample_at,
      avg(confidence) as confidence
    from filtered
    where effective_unit_price is not null
    group by product_id, product_name, brand_id, brand_name, store_id, store_name, packaging, variant
  ),
  combos_with_min as (
    select c.*,
      min(c.effective_unit_price) over (partition by product_id) as lowest_unit_price
    from combos c
  )
  insert into public.product_price_tiers (
    product_id,
    product_name,
    brand_id,
    brand_name,
    store_id,
    store_name,
    packaging,
    variant,
    tier,
    unit_price,
    effective_unit_price,
    delta_pct,
    sample_count,
    confidence,
    currency,
    last_sample_at
  )
  select
    product_id,
    product_name,
    brand_id,
    brand_name,
    store_id,
    store_name,
    packaging,
    variant,
    case
      when effective_unit_price = lowest_unit_price then 'lowest'
      when lowest_unit_price is not null and effective_unit_price <= lowest_unit_price * 1.1 then 'mid'
      else 'highest'
    end as tier,
    avg_unit_price,
    effective_unit_price,
    case
      when lowest_unit_price is null or lowest_unit_price = 0 then null
      else round(((effective_unit_price - lowest_unit_price) / lowest_unit_price) * 100, 2)
    end as delta_pct,
    sample_count,
    confidence,
    currency,
    last_sample_at
  from combos_with_min;
end;
$$;

create or replace function public.best_price_tiers_for_products(
  product_ids uuid[],
  limit_results integer default 200
)
returns table (
  product_id uuid,
  product_name text,
  brand_id uuid,
  brand_name text,
  store_id uuid,
  store_name text,
  packaging text,
  variant text,
  tier text,
  unit_price numeric,
  effective_unit_price numeric,
  delta_pct numeric,
  sample_count integer,
  confidence numeric,
  currency text,
  last_sample_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ppt.product_id,
    ppt.product_name,
    ppt.brand_id,
    ppt.brand_name,
    ppt.store_id,
    ppt.store_name,
    ppt.packaging,
    ppt.variant,
    ppt.tier,
    ppt.unit_price,
    ppt.effective_unit_price,
    ppt.delta_pct,
    ppt.sample_count,
    ppt.confidence,
    ppt.currency,
    ppt.last_sample_at
  from public.product_price_tiers ppt
  where
    (product_ids is null or array_length(product_ids, 1) is null or ppt.product_id = any(product_ids))
  order by
    ppt.product_id,
    case ppt.tier when 'lowest' then 0 when 'mid' then 1 else 2 end,
    coalesce(ppt.delta_pct, 0)
  limit limit_results;
$$;

grant execute on function public.best_price_tiers_for_products(uuid[], integer) to authenticated;
