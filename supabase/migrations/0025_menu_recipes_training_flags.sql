-- Menu recipes training flags, origin tracking, and lightweight training queue

alter table public.menu_recipes
  add column if not exists origin text default 'llm_initial',
  add column if not exists edited_by_user boolean not null default false,
  add column if not exists needs_training boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_recipes'::regclass
      and conname = 'menu_recipes_origin_check'
  ) then
    alter table public.menu_recipes
      add constraint menu_recipes_origin_check
        check (origin in ('llm_initial', 'llm_regen', 'user_edit'));
  end if;
end $$;

create table if not exists public.menu_recipe_training_queue (
  recipe_id uuid primary key references public.menu_recipes (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  origin text default 'user_edit',
  version integer,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_recipe_training_queue'::regclass
      and conname = 'menu_recipe_training_origin_check'
  ) then
    alter table public.menu_recipe_training_queue
      add constraint menu_recipe_training_origin_check
        check (origin in ('llm_initial', 'llm_regen', 'user_edit'));
  end if;
end $$;

create index if not exists menu_recipe_training_status_idx
  on public.menu_recipe_training_queue (status, updated_at desc);

alter table public.menu_recipe_training_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_recipe_training_queue'
      and policyname = 'menu_recipe_training_owner'
  ) then
    create policy menu_recipe_training_owner
      on public.menu_recipe_training_queue
      for all
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;
end $$;

grant all on public.menu_recipe_training_queue to service_role;
