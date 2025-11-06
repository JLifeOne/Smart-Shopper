create table if not exists public.brand_price_insights (
  brand_id uuid not null references public.brands(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  category text,
  avg_unit_price numeric,
  min_unit_price numeric,
  max_unit_price numeric,
  delta_percent numeric,
  sample_count integer,
  last_sample_at timestamptz,
  trend_percent_30d numeric,
  currency text,
  confidence numeric,
  created_at timestamptz not null default now(),
  primary key (brand_id, store_id, category)
);

create or replace function public.refresh_brand_price_insights()
returns void
language plpgsql
as $$
begin
  delete from public.brand_price_insights;

  insert into public.brand_price_insights (
    brand_id,
    store_id,
    category,
    avg_unit_price,
    min_unit_price,
    max_unit_price,
    delta_percent,
    sample_count,
    last_sample_at,
    trend_percent_30d,
    currency,
    confidence,
    created_at
  )
  select
    pp.brand_id,
    pp.store_id,
    p.category,
    avg(pp.price) as avg_unit_price,
    min(pp.price) as min_unit_price,
    max(pp.price) as max_unit_price,
    0 as delta_percent,
    count(*)::integer as sample_count,
    max(pp.captured_at) as last_sample_at,
    case
      when avg(case when pp.captured_at >= now() - interval '60 days' and pp.captured_at < now() - interval '30 days' then pp.price end) is null then null
      when avg(case when pp.captured_at >= now() - interval '60 days' and pp.captured_at < now() - interval '30 days' then pp.price end) = 0 then null
      else (
        (
          avg(case when pp.captured_at >= now() - interval '30 days' then pp.price end)
          - avg(case when pp.captured_at >= now() - interval '60 days' and pp.captured_at < now() - interval '30 days' then pp.price end)
        )
        / avg(case when pp.captured_at >= now() - interval '60 days' and pp.captured_at < now() - interval '30 days' then pp.price end)
      ) * 100
    end as trend_percent_30d,
    max(pp.currency) as currency,
    avg(coalesce(pp.brand_confidence, 0.5)) as confidence,
    now() as created_at
  from public.price_points pp
    join public.products p on p.id = pp.product_id
  where
    pp.brand_id is not null
    and pp.price is not null
    and pp.captured_at >= now() - interval '90 days'
  group by pp.brand_id, pp.store_id, p.category;
end;
$$;

create or replace function public.brand_insights_for_user(
  user_id uuid,
  limit_results integer default 50
)
returns table (
  brand_id uuid,
  store_id uuid,
  category text,
  avg_unit_price numeric,
  min_unit_price numeric,
  max_unit_price numeric,
  sample_count integer,
  last_sample_at timestamptz,
  trend_percent_30d numeric,
  currency text,
  confidence numeric
)
language sql
security definer
set search_path = public
as $$
  select
    bpi.brand_id,
    bpi.store_id,
    bpi.category,
    bpi.avg_unit_price,
    bpi.min_unit_price,
    bpi.max_unit_price,
    bpi.sample_count,
    bpi.last_sample_at,
    bpi.trend_percent_30d,
    bpi.currency,
    bpi.confidence
  from public.brand_price_insights bpi
  order by bpi.confidence desc nulls last, bpi.sample_count desc
  limit limit_results;
$$;

grant execute on function public.brand_insights_for_user(uuid, integer) to authenticated;
