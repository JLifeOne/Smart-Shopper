-- Menu data foundations (recipes, sessions, combos, style cache, packaging)

set check_function_bodies = off;

create table if not exists public.menu_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  course text,
  cuisine_style text,
  servings jsonb not null default jsonb_build_object('people_count', 1, 'portion_size_per_person', null),
  scale_factor numeric not null default 1,
  ingredients jsonb not null default '[]'::jsonb,
  method jsonb not null default '[]'::jsonb,
  tips text[] default '{}',
  packaging_notes text,
  packaging_guidance jsonb default '[]'::jsonb,
  source text default 'user',
  premium_required boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_recipes_owner_idx on public.menu_recipes (owner_id);
create index if not exists menu_recipes_created_idx on public.menu_recipes (created_at desc);

create table if not exists public.menu_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  source_asset_url text,
  detected_document_type text,
  dish_titles text[] default '{}',
  card_ids uuid[] default '{}',
  payload jsonb default '{}'::jsonb,
  warnings text[] default '{}',
  is_premium boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_sessions_owner_idx on public.menu_sessions (owner_id, status);

create table if not exists public.menu_combos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  dish_ids uuid[] not null default '{}',
  locale text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_combos_owner_idx on public.menu_combos (owner_id, is_default);

create table if not exists public.menu_style_choices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  dish_key text not null,
  locale text,
  style_choice text not null,
  last_used_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists menu_style_unique on public.menu_style_choices (owner_id, dish_key);

create table if not exists public.menu_packaging_profiles (
  id uuid primary key default gen_random_uuid(),
  locale text not null,
  store_id uuid references public.stores (id) on delete set null,
  label text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_packaging_units (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.menu_packaging_profiles (id) on delete cascade,
  ingredient_key text not null,
  pack_size numeric not null,
  pack_unit text not null,
  display_label text,
  last_used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_packaging_units_profile_idx on public.menu_packaging_units (profile_id, ingredient_key);

alter table public.menu_recipes enable row level security;
alter table public.menu_sessions enable row level security;
alter table public.menu_combos enable row level security;
alter table public.menu_style_choices enable row level security;
alter table public.menu_packaging_profiles enable row level security;
alter table public.menu_packaging_units enable row level security;

create policy "menu_recipes_owner_select" on public.menu_recipes for select using (owner_id = auth.uid());
create policy "menu_recipes_owner_modify" on public.menu_recipes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu_sessions_owner_select" on public.menu_sessions for select using (owner_id = auth.uid());
create policy "menu_sessions_owner_modify" on public.menu_sessions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu_combos_owner_select" on public.menu_combos for select using (owner_id = auth.uid());
create policy "menu_combos_owner_modify" on public.menu_combos for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu_style_owner_select" on public.menu_style_choices for select using (owner_id = auth.uid());
create policy "menu_style_owner_modify" on public.menu_style_choices for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu_packaging_profiles_select" on public.menu_packaging_profiles for select using (true);
create policy "menu_packaging_units_select" on public.menu_packaging_units for select using (true);

-- allow service role (supabase) full control if needed
grant all on public.menu_recipes to service_role;
grant all on public.menu_sessions to service_role;
grant all on public.menu_combos to service_role;
grant all on public.menu_style_choices to service_role;
grant all on public.menu_packaging_profiles to service_role;
grant all on public.menu_packaging_units to service_role;
