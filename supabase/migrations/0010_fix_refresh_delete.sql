-- Fix refresh function to comply with safe-update settings (DELETE must have WHERE)
-- Also mark as security definer for controlled execution by job function

create or replace function public.refresh_brand_price_insights()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Compliant with environments that disallow DELETE without WHERE
  delete from public.brand_price_insights where true;

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

