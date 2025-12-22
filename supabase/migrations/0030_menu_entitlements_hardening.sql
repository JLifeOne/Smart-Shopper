-- Menu entitlements hardening (production safety)
-- Goals:
-- - Prevent menu_dev_bypass from granting premium to *all* users.
-- - Enforce premium access to recipe-card data server-side (RLS + helper).
-- - Enforce concurrent session caps in the same atomic path as session creation.

set check_function_bodies = off;

-- 1) Premium checks must be server-driven and safe to misconfiguration.
--    menu_dev_bypass is a developer-only bypass and must never elevate non-dev users.
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
  is_premium boolean := coalesce((app_meta->>'is_menu_premium')::boolean, false);
  is_developer boolean := coalesce((app_meta->>'is_developer')::boolean, false)
    or coalesce((app_meta->>'dev')::boolean, false);
begin
  return is_premium
    or (dev_bypass_enabled and is_developer);
end;
$$;

-- 2) Premium-gate recipe access via RLS (prevents clients from bypassing edge-function gating).
drop policy if exists "menu_recipes_owner_select" on public.menu_recipes;
drop policy if exists "menu_recipes_owner_modify" on public.menu_recipes;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_recipes'
      and policyname = 'menu_recipes_premium_select'
  ) then
    create policy "menu_recipes_premium_select" on public.menu_recipes
      for select using (owner_id = auth.uid() and public.menu_is_premium_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_recipes'
      and policyname = 'menu_recipes_premium_modify'
  ) then
    create policy "menu_recipes_premium_modify" on public.menu_recipes
      for all
      using (owner_id = auth.uid() and public.menu_is_premium_user())
      with check (owner_id = auth.uid() and public.menu_is_premium_user());
  end if;
end $$;

-- 3) Enforce concurrent session caps during session creation (atomic, replay-safe).
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

  -- Serialize session creation per owner so concurrent-session limits can't be bypassed by races
  -- (e.g., rapid taps or client retries that generate distinct idempotency keys).
  if to_regprocedure('pg_catalog.hashtextextended(text,bigint)') is not null then
    perform pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner_id::text, 0));
  else
    -- Fallback (older Postgres): 32-bit hash; may collide but still prevents same-user races.
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
