-- Menu freemium limits + recipe access updates
-- Goals:
-- - Allow all users to access menu features with freemium caps (3 full uses/day).
-- - Premium/dev users get higher daily limits (10/day).
-- - Keep dev-only bypass guarded by app_environment (see 0034).
-- - Allow owners to read/update their recipes regardless of premium status.

set check_function_bodies = off;

-- 1) Restore owner-only policies for menu_recipes (no premium gating).
drop policy if exists "menu_recipes_premium_select" on public.menu_recipes;
drop policy if exists "menu_recipes_premium_modify" on public.menu_recipes;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_recipes'
      and policyname = 'menu_recipes_owner_select'
  ) then
    create policy "menu_recipes_owner_select" on public.menu_recipes
      for select using (owner_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_recipes'
      and policyname = 'menu_recipes_owner_modify'
  ) then
    create policy "menu_recipes_owner_modify" on public.menu_recipes
      for all using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
  end if;
end $$;

-- 2) Default new recipes to non-premium gating (freemium access now uses limits, not RLS).
alter table public.menu_recipes
  alter column premium_required set default false;

-- Backfill existing rows so UI doesn't treat them as premium-only.
update public.menu_recipes
set premium_required = false
where premium_required = true;

-- 3) Update session/list/title-only RPCs to use new freemium limits.
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
  v_upload_limit int := case when v_is_premium_user then 10 else 3 end;
  v_list_limit int := case when v_is_premium_user then 10 else 3 end;
  v_concurrent_limit int := case when v_is_premium_user then 5 else 1 end;
  v_today date := (timezone('utc', now()))::date;
  v_inserted_id uuid;
  v_active_sessions int;
begin
  if v_owner_id is null then
    raise exception 'auth_required';
  end if;

  if v_key is null then
    raise exception 'idempotency_key_required';
  end if;

  select id into session_id
  from public.menu_sessions
  where owner_id = v_owner_id
    and idempotency_key = v_key;
  if found then
    replay := true;
    return next;
    return;
  end if;

  if to_regprocedure('pg_catalog.hashtextextended(text,bigint)') is not null then
    perform pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner_id::text, 0));
  else
    perform pg_advisory_xact_lock(pg_catalog.hashtext(v_owner_id::text));
  end if;

  select count(*)::int into v_active_sessions
  from public.menu_sessions
  where owner_id = v_owner_id
    and status in ('pending', 'processing', 'needs_clarification');
  if v_active_sessions >= v_concurrent_limit then
    raise exception 'concurrent_session_limit';
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
  v_upload_limit int := case when v_is_premium_user then 10 else 3 end;
  v_list_limit int := case when v_is_premium_user then 10 else 3 end;
  v_today date := (timezone('utc', now()))::date;
  v_inserted_id uuid;
  v_list_name text := nullif(btrim(_name), '');
begin
  if v_owner_id is null then
    raise exception 'auth_required';
  end if;

  if v_key is null then
    raise exception 'idempotency_key_required';
  end if;

  if v_list_name is null then
    v_list_name := 'Menu plan ' || to_char(timezone('utc', now()), 'YYYY-MM-DD');
  end if;

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
  v_upload_limit int := case when v_is_premium_user then 10 else 3 end;
  v_list_limit int := case when v_is_premium_user then 10 else 3 end;
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
