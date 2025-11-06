-- Add simple listing RPC without misleading user_id argument

create or replace function public.brand_price_insights_list(
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

grant execute on function public.brand_price_insights_list(integer) to authenticated;

comment on function public.brand_insights_for_user(uuid, integer) is 'Deprecated: prefer brand_price_insights_list(limit_results).';

