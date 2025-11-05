create table if not exists public.brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  normalized_name text not null,
  manufacturer text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists brands_normalized_name_idx
  on public.brands (lower(normalized_name));

create table if not exists public.brand_aliases (
  id uuid primary key default uuid_generate_v4(),
  brand_id uuid references public.brands(id) on delete cascade,
  alias text not null,
  store_id uuid references public.stores(id) on delete cascade,
  confidence numeric,
  source text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists brand_alias_unique_idx
  on public.brand_aliases (lower(alias), coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table if exists public.products
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists brand_confidence numeric,
  add column if not exists brand_source text;

alter table if exists public.product_aliases
  add column if not exists brand_id uuid references public.brands(id) on delete set null;

alter table if exists public.price_points
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists brand_confidence numeric;

create table if not exists public.app_runtime_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_runtime_config (key, value)
values ('brand_insights', jsonb_build_object('enabled', true))
on conflict (key) do nothing;

create trigger set_timestamp_brands
  before update on public.brands
  for each row execute function public.set_updated_at();

create trigger set_timestamp_brand_aliases
  before update on public.brand_aliases
  for each row execute function public.set_updated_at();

create trigger set_timestamp_runtime_config
  before update on public.app_runtime_config
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.brand_aliases enable row level security;
alter table public.app_runtime_config enable row level security;

create policy "Allow authenticated read brands"
  on public.brands
  for select
  using (auth.role() = 'authenticated');

create policy "Allow authenticated read brand aliases"
  on public.brand_aliases
  for select
  using (auth.role() = 'authenticated');

create policy "Allow authenticated read runtime config"
  on public.app_runtime_config
  for select
  using (auth.role() = 'authenticated');

create or replace function public.get_runtime_config(config_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select value from public.app_runtime_config where key = config_key;
$$;

revoke all on function public.get_runtime_config(text) from public;
grant execute on function public.get_runtime_config(text) to authenticated;
