-- Menu freemium lifetime limits + totals tracking
-- Goals:
-- - Freemium users get 3 total menu runs (uploads + list creates).
-- - Premium/dev users keep 10 runs per day (daily counters).
-- - Track lifetime usage in menu_usage_totals for freemium enforcement.

set check_function_bodies = off;

create table if not exists public.menu_usage_totals (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  uploads_total int not null default 0,
  list_creates_total int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_timestamp_menu_usage_totals
  before update on public.menu_usage_totals
  for each row execute function public.set_updated_at();

alter table public.menu_usage_totals enable row level security;

create policy "menu_usage_totals_owner_select" on public.menu_usage_totals
  for select using (owner_id = auth.uid());

create policy "menu_usage_totals_owner_upsert" on public.menu_usage_totals
  for insert with check (owner_id = auth.uid());

create policy "menu_usage_totals_owner_update" on public.menu_usage_totals
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

grant all on public.menu_usage_totals to service_role;

create or replace function public.increment_menu_usage_total(
  _owner_id uuid,
  _uploads_inc int,
  _list_inc int,
  _upload_limit int,
  _list_limit int
) returns table (uploads_total int, list_creates_total int)
language plpgsql
as $$
declare
  v_uploads int;
  v_lists int;
begin
  if auth.uid() is null or auth.uid() <> _owner_id then
    raise exception 'not_owner';
  end if;

  with upserted as (
    insert into public.menu_usage_totals (owner_id, uploads_total, list_creates_total)
    values (_owner_id, greatest(_uploads_inc, 0), greatest(_list_inc, 0))
    on conflict (owner_id) do update
      set uploads_total = public.menu_usage_totals.uploads_total + greatest(_uploads_inc, 0),
          list_creates_total = public.menu_usage_totals.list_creates_total + greatest(_list_inc, 0),
          updated_at = timezone('utc', now())
      where public.menu_usage_totals.uploads_total + greatest(_uploads_inc, 0) <= _upload_limit
        and public.menu_usage_totals.list_creates_total + greatest(_list_inc, 0) <= _list_limit
    returning
      public.menu_usage_totals.uploads_total as new_uploads,
      public.menu_usage_totals.list_creates_total as new_list_creates
  )
  select upserted.new_uploads, upserted.new_list_creates
    into v_uploads, v_lists
  from upserted;

  if not found then
    return;
  end if;

  if v_uploads > _upload_limit or v_lists > _list_limit then
    raise exception 'limit_exceeded';
  end if;

  return query select v_uploads, v_lists;
end;
$$;

-- Backfill lifetime totals from daily counters (clamp to freemium cap).
insert into public.menu_usage_totals (owner_id, uploads_total, list_creates_total)
select
  owner_id,
  least(sum(uploads), 3)::int,
  least(sum(list_creates), 3)::int
from public.menu_usage_counters
group by owner_id
on conflict (owner_id) do update
  set uploads_total = greatest(public.menu_usage_totals.uploads_total, excluded.uploads_total),
      list_creates_total = greatest(public.menu_usage_totals.list_creates_total, excluded.list_creates_total),
      updated_at = timezone('utc', now());

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

  if v_is_premium_user then
    perform *
    from public.increment_menu_usage(
      v_owner_id,
      v_today,
      1,
      0,
      v_upload_limit,
      v_list_limit
    );
  else
    perform *
    from public.increment_menu_usage_total(
      v_owner_id,
      1,
      0,
      v_upload_limit,
      v_list_limit
    );
  end if;
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

  if v_is_premium_user then
    perform *
    from public.increment_menu_usage(
      v_owner_id,
      v_today,
      0,
      1,
      v_upload_limit,
      v_list_limit
    );
  else
    perform *
    from public.increment_menu_usage_total(
      v_owner_id,
      0,
      1,
      v_upload_limit,
      v_list_limit
    );
  end if;
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

  if v_is_premium_user then
    perform *
    from public.increment_menu_usage(
      v_owner_id,
      v_today,
      1,
      0,
      v_upload_limit,
      v_list_limit
    );
  else
    perform *
    from public.increment_menu_usage_total(
      v_owner_id,
      1,
      0,
      v_upload_limit,
      v_list_limit
    );
  end if;
  if not found then
    raise exception 'limit_exceeded';
  end if;

  dish_id := v_inserted_id;
  replay := false;
  return next;
end;
$$;
