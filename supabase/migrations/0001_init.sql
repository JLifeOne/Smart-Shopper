create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  locale text default 'en-JM',
  currency text default 'JMD',
  include_tax boolean default true,
  default_store_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  brand text,
  address text,
  geo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  brand text,
  name text not null,
  category text not null,
  size_value numeric not null,
  size_unit text not null,
  barcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_aliases (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  raw_name text not null,
  store_id uuid references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.price_points (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  price numeric not null,
  currency text not null,
  size_value numeric,
  size_unit text,
  source text not null check (source in ('receipt', 'user', 'import')),
  discount jsonb,
  captured_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lists (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.list_members (
  list_id uuid references public.lists(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create table if not exists public.list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references public.lists(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  label text not null,
  desired_qty numeric not null default 1,
  substitutions_ok boolean default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_on_hand numeric not null default 0,
  last_purchase_at timestamptz,
  est_days_left integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rule_type text not null check (rule_type in ('target_price', 'percent_drop')),
  threshold numeric not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_timestamp_profiles
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_timestamp_stores
before update on public.stores
for each row execute function public.set_updated_at();

create trigger set_timestamp_products
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_timestamp_lists
before update on public.lists
for each row execute function public.set_updated_at();

create trigger set_timestamp_list_items
before update on public.list_items
for each row execute function public.set_updated_at();

create trigger set_timestamp_alerts
before update on public.alerts
for each row execute function public.set_updated_at();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.list_items enable row level security;
alter table public.price_points enable row level security;
alter table public.inventory enable row level security;
alter table public.alerts enable row level security;

-- Policies
create policy "Profiles are editable by owner" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Owner can manage lists"
  on public.lists
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Members can read lists"
  on public.lists
  for select using (
    auth.uid() = owner_id or
    auth.uid() in (select user_id from public.list_members where list_id = id)
  );

create policy "Members manage list items"
  on public.list_items
  for all using (
    auth.uid() in (
      select owner_id from public.lists where id = list_id
    ) or auth.uid() in (
      select user_id from public.list_members where list_id = public.list_items.list_id and role in ('owner','editor')
    )
  )
  with check (
    auth.uid() in (
      select owner_id from public.lists where id = list_id
    ) or auth.uid() in (
      select user_id from public.list_members where list_id = public.list_items.list_id and role in ('owner','editor')
    )
  );

create policy "Members read list items"
  on public.list_items
  for select using (
    auth.uid() in (
      select owner_id from public.lists where id = list_id
    ) or auth.uid() in (
      select user_id from public.list_members where list_id = public.list_items.list_id
    )
  );

create policy "Users manage own price points"
  on public.price_points
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage inventory"
  on public.inventory
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage alerts"
  on public.alerts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Useful indexes
create index if not exists idx_price_points_product_store on public.price_points (product_id, store_id);
create index if not exists idx_price_points_timestamp on public.price_points (captured_at desc);
create index if not exists idx_product_aliases_product on public.product_aliases (product_id);
create index if not exists idx_list_items_list on public.list_items (list_id);
