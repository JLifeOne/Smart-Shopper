-- Menu idempotency for sessions, list creation, and reviews
-- Goal: make replay/double-submit safe under retries and concurrency.

set check_function_bodies = off;

-- 1) menu_sessions: add idempotency + intent routing metadata, and make card_ids compatible with menus-llm schema
alter table public.menu_sessions
  add column if not exists idempotency_key text,
  add column if not exists intent_route text;

-- menu_sessions.card_ids: allow non-UUID card ids (menus-llm schema uses string ids)
do $$
begin
  -- If the column exists, coerce to text[] (uuid[] -> text[] is safe; text[] -> text[] is no-op).
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_sessions'
      and column_name = 'card_ids'
  ) then
    alter table public.menu_sessions
      alter column card_ids type text[] using card_ids::text[];
    alter table public.menu_sessions
      alter column card_ids set default '{}'::text[];
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_sessions'::regclass
      and conname = 'menu_sessions_idempotency_key_valid'
  ) then
    alter table public.menu_sessions
      add constraint menu_sessions_idempotency_key_valid
        check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 255);
  end if;
end $$;

create unique index if not exists menu_sessions_owner_idempotency_idx
  on public.menu_sessions (owner_id, idempotency_key);

-- 2) lists: add idempotency_key so menus-lists can be replay-safe
alter table public.lists
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lists'::regclass
      and conname = 'lists_idempotency_key_valid'
  ) then
    alter table public.lists
      add constraint lists_idempotency_key_valid
        check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 255);
  end if;
end $$;

create unique index if not exists lists_owner_idempotency_idx
  on public.lists (owner_id, idempotency_key);

-- 3) menu_review_queue: add idempotency_key to prevent duplicate review rows on retries
do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'menu_review_queue'
  ) then
    create table public.menu_review_queue (
      id uuid primary key default gen_random_uuid(),
      owner_id uuid not null references auth.users(id) on delete cascade,
      session_id uuid references public.menu_sessions(id) on delete set null,
      card_id text,
      dish_title text,
      reason text default 'flagged',
      note text,
      status text not null default 'pending', -- pending | acknowledged | resolved
      created_at timestamptz not null default now(),
      reviewed_at timestamptz,
      idempotency_key text
    );

    alter table public.menu_review_queue enable row level security;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'menu_review_queue'
        and policyname = 'menu_review_queue_owner_select'
    ) then
      create policy "menu_review_queue_owner_select" on public.menu_review_queue
        for select using (auth.uid() = owner_id);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'menu_review_queue'
        and policyname = 'menu_review_queue_owner_insert'
    ) then
      create policy "menu_review_queue_owner_insert" on public.menu_review_queue
        for insert with check (auth.uid() = owner_id);
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'menu_review_queue'
        and policyname = 'menu_review_queue_owner_update'
    ) then
      create policy "menu_review_queue_owner_update" on public.menu_review_queue
        for update using (auth.uid() = owner_id);
    end if;

    grant all on public.menu_review_queue to service_role;
  end if;
end $$;

alter table public.menu_review_queue
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_review_queue'::regclass
      and conname = 'menu_review_queue_idempotency_key_valid'
  ) then
    alter table public.menu_review_queue
      add constraint menu_review_queue_idempotency_key_valid
        check (idempotency_key is null or length(btrim(idempotency_key)) between 1 and 255);
  end if;
end $$;

create unique index if not exists menu_review_queue_owner_idempotency_idx
  on public.menu_review_queue (owner_id, idempotency_key);

-- 4) Helper functions: compute premium limits from JWT claims (server-side; no client-supplied limits)
create or replace function public.menu_jwt_claims()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create or replace function public.menu_is_premium_user()
returns boolean
language plpgsql
stable
as $$
declare
  claims jsonb := public.menu_jwt_claims();
  app_meta jsonb := coalesce(claims->'app_metadata', '{}'::jsonb);
  runtime_config jsonb := public.get_runtime_config('menu_dev_bypass');
  dev_bypass_enabled boolean := coalesce((runtime_config->>'enabled')::boolean, false);
begin
  return coalesce((app_meta->>'is_menu_premium')::boolean, false)
    or coalesce((app_meta->>'is_developer')::boolean, false)
    or coalesce((app_meta->>'dev')::boolean, false)
    or dev_bypass_enabled;
end;
$$;

-- 5) Atomic, replay-safe session creation that also increments daily upload usage
create or replace function public.menu_create_session(
  _idempotency_key text,
  _source_asset_url text,
  _detected_document_type text,
  _metadata jsonb default '{}'::jsonb,
  _requested_is_premium boolean default null
) returns table (session_id uuid, replay boolean)
language plpgsql
as $$
declare
  v_owner_id uuid := auth.uid();
  v_key text := nullif(btrim(_idempotency_key), '');
  v_is_premium_user boolean := public.menu_is_premium_user();
  v_is_premium_session boolean := case
    when _requested_is_premium is null then v_is_premium_user
    else (_requested_is_premium and v_is_premium_user)
  end;
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

  -- Fast-path replay
  select id into session_id
  from public.menu_sessions
  where owner_id = v_owner_id
    and idempotency_key = v_key;
  if found then
    replay := true;
    return next;
    return;
  end if;

  insert into public.menu_sessions (
    owner_id,
    status,
    source_asset_url,
    detected_document_type,
    dish_titles,
    card_ids,
    payload,
    warnings,
    is_premium,
    idempotency_key
  ) values (
    v_owner_id,
    'pending',
    _source_asset_url,
    _detected_document_type,
    '{}'::text[],
    '{}'::text[],
    coalesce(_metadata, '{}'::jsonb),
    '{}'::text[],
    v_is_premium_session,
    v_key
  )
  on conflict (owner_id, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Lost the race: treat as replay
    select id into session_id
    from public.menu_sessions
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

  session_id := v_inserted_id;
  replay := false;
  return next;
end;
$$;

-- 6) Atomic, replay-safe list creation for menus-lists (also increments daily list-create usage)
create or replace function public.menu_create_list(
  _idempotency_key text,
  _name text,
  _items jsonb
) returns table (list_id uuid, replay boolean)
language plpgsql
as $$
declare
  v_owner_id uuid := auth.uid();
  v_key text := nullif(btrim(_idempotency_key), '');
  v_is_premium_user boolean := public.menu_is_premium_user();
  v_upload_limit int := case when v_is_premium_user then 25 else 3 end;
  v_list_limit int := case when v_is_premium_user then 25 else 1 end;
  v_today date := (timezone('utc', now()))::date;
  v_inserted_id uuid;
  v_list_name text := nullif(btrim(_name), '');
begin
  if v_owner_id is null then
    raise exception 'auth_required';
  end if;

  if not v_is_premium_user then
    raise exception 'premium_required';
  end if;

  if v_key is null then
    raise exception 'idempotency_key_required';
  end if;

  if v_list_name is null then
    v_list_name := 'Menu plan ' || to_char(timezone('utc', now()), 'YYYY-MM-DD');
  end if;

  -- Fast-path replay
  select id into list_id
  from public.lists
  where owner_id = v_owner_id
    and idempotency_key = v_key;
  if found then
    replay := true;
    return next;
    return;
  end if;

  insert into public.lists (owner_id, name, shared, idempotency_key)
  values (v_owner_id, v_list_name, false, v_key)
  on conflict (owner_id, idempotency_key) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select id into list_id
    from public.lists
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
    0,
    1,
    v_upload_limit,
    v_list_limit
  );
  if not found then
    raise exception 'limit_exceeded';
  end if;

  insert into public.list_items (list_id, label, desired_qty, notes)
  select
    v_inserted_id,
    coalesce(item.label, item.name),
    coalesce(item.desired_qty, item.quantity, 1),
    item.notes
  from jsonb_to_recordset(coalesce(_items, '[]'::jsonb)) as item(
    label text,
    name text,
    desired_qty numeric,
    quantity numeric,
    notes text
  )
  where coalesce(item.label, item.name) is not null
    and length(btrim(coalesce(item.label, item.name))) > 0;

  list_id := v_inserted_id;
  replay := false;
  return next;
end;
$$;
