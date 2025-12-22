-- Title-only dish persistence + daily limit enforcement
-- Goal: remove AsyncStorage-only title-only saves so limits and library sync are enforced server-side.
-- This reuses menu_usage_counters.uploads for the free-tier daily cap, keeping policy + UX aligned.

set check_function_bodies = off;

create table if not exists public.menu_title_dishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid references public.menu_sessions (id) on delete set null,
  title text not null,
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists menu_title_dishes_owner_idx
  on public.menu_title_dishes (owner_id, created_at desc);

create unique index if not exists menu_title_dishes_owner_idempotency_idx
  on public.menu_title_dishes (owner_id, idempotency_key);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_title_dishes'::regclass
      and conname = 'menu_title_dishes_idempotency_key_valid'
  ) then
    alter table public.menu_title_dishes
      add constraint menu_title_dishes_idempotency_key_valid
        check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 255);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_title_dishes'::regclass
      and conname = 'menu_title_dishes_title_nonempty'
  ) then
    alter table public.menu_title_dishes
      add constraint menu_title_dishes_title_nonempty
        check (length(btrim(title)) > 0);
  end if;
end $$;

alter table public.menu_title_dishes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_title_dishes'
      and policyname = 'menu_title_dishes_owner_select'
  ) then
    create policy "menu_title_dishes_owner_select" on public.menu_title_dishes
      for select using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_title_dishes'
      and policyname = 'menu_title_dishes_owner_modify'
  ) then
    create policy "menu_title_dishes_owner_modify" on public.menu_title_dishes
      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
end $$;

grant all on public.menu_title_dishes to service_role;

-- Atomic, replay-safe title-only save (also increments daily upload usage).
create or replace function public.menu_create_title_dish(
  _idempotency_key text,
  _title text,
  _session_id uuid default null
) returns table (dish_id uuid, replay boolean)
language plpgsql
as $$
declare
  v_owner_id uuid := auth.uid();
  v_key text := nullif(btrim(_idempotency_key), '');
  v_title text := nullif(btrim(_title), '');
  v_is_premium_user boolean := public.menu_is_premium_user();
  v_upload_limit int := case when v_is_premium_user then 25 else 3 end;
  v_list_limit int := case when v_is_premium_user then 25 else 1 end;
  v_today date := (timezone('utc', now()))::date;
  v_inserted_id uuid;
begin
  if v_owner_id is null then
    raise exception 'auth_required';
  end if;

  if v_key is null then
    raise exception 'idempotency_key_required';
  end if;

  if v_title is null then
    raise exception 'title_required';
  end if;

  -- Fast-path replay
  select id into dish_id
  from public.menu_title_dishes
  where owner_id = v_owner_id
    and idempotency_key = v_key;
  if found then
    replay := true;
    return next;
    return;
  end if;

  insert into public.menu_title_dishes (owner_id, session_id, title, idempotency_key)
  values (v_owner_id, _session_id, v_title, v_key)
  on conflict (owner_id, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select id into dish_id
    from public.menu_title_dishes
    where owner_id = v_owner_id
      and idempotency_key = v_key;
    replay := true;
    return next;
    return;
  end if;

  perform *
  from public.increment_menu_usage(
    v_owner_id,
    v_today,
    1,
    0,
    v_upload_limit,
    v_list_limit
  );
  if not found then
    raise exception 'limit_exceeded';
  end if;

  dish_id := v_inserted_id;
  replay := false;
  return next;
end;
$$;

