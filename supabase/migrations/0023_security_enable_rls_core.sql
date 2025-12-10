-- Enable RLS on catalog tables and enforce policies

begin;

-- Enable RLS for tables flagged by Security Advisor
alter table if exists public.list_invites enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.stores enable row level security;
alter table if exists public.product_aliases enable row level security;
alter table if exists public.product_price_tiers enable row level security;

-- List invites already has policies; ensure RLS is enforced
alter table if exists public.list_invites force row level security;

-- Authenticated read access to catalog tables (writes remain service role)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'authenticated read products'
  ) then
    create policy "authenticated read products"
      on public.products
      for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'stores' and policyname = 'authenticated read stores'
  ) then
    create policy "authenticated read stores"
      on public.stores
      for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_aliases' and policyname = 'authenticated read product_aliases'
  ) then
    create policy "authenticated read product_aliases"
      on public.product_aliases
      for select
      using (auth.uid() is not null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_price_tiers' and policyname = 'authenticated read product_price_tiers'
  ) then
    create policy "authenticated read product_price_tiers"
      on public.product_price_tiers
      for select
      using (auth.uid() is not null);
  end if;
end$$;

commit;
