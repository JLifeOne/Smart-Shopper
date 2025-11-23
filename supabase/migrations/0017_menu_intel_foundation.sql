-- Menu intelligence foundation (session items, feature vectors, user preferences)

set check_function_bodies = off;

create table if not exists public.menu_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.menu_sessions (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  raw_text text not null,
  normalized_text text,
  confidence numeric,
  locale_hint text,
  classifier_tags text[] default '{}',
  bounding_box jsonb default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_session_items_session_idx on public.menu_session_items (session_id);
create index if not exists menu_session_items_owner_idx on public.menu_session_items (owner_id, status);

create table if not exists public.menu_user_preferences (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  locale text,
  dietary_tags text[] default '{}',
  allergen_flags text[] default '{}',
  default_people_count integer not null default 1,
  auto_scale boolean not null default true,
  allow_card_lock boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_feature_vectors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  feature_scope text not null,
  vector double precision[] not null,
  metadata jsonb default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists menu_feature_scope_owner_idx on public.menu_feature_vectors (owner_id, feature_scope);

alter table public.menu_session_items enable row level security;
alter table public.menu_user_preferences enable row level security;
alter table public.menu_feature_vectors enable row level security;

create policy "menu_session_items_owner" on public.menu_session_items
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu_user_preferences_owner" on public.menu_user_preferences
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu_feature_vectors_owner" on public.menu_feature_vectors
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant all on public.menu_session_items to service_role;
grant all on public.menu_user_preferences to service_role;
grant all on public.menu_feature_vectors to service_role;
