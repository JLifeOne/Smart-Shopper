-- Secure brand_price_insights: enable RLS and block direct reads by clients.
-- Access should go via the security definer RPC: public.brand_insights_for_user.

alter table if exists public.brand_price_insights enable row level security;

-- Optional: allow service role to read directly (jobs/maintenance). Most service role traffic
-- bypasses RLS, but this keeps intent explicit.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brand_price_insights' and policyname = 'service_role_can_read_brand_price_insights'
  ) then
    create policy "service_role_can_read_brand_price_insights"
      on public.brand_price_insights
      for select
      using (auth.role() = 'service_role');
  end if;
end $$;

comment on table public.brand_price_insights is 'Aggregated brand/store/category pricing insights. Use RPC public.brand_insights_for_user for client access.';

