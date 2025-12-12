begin;

select plan(21);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_sessions'
      and column_name = 'idempotency_key'
  ),
  'menu_sessions.idempotency_key column present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_sessions'
      and column_name = 'intent_route'
  ),
  'menu_sessions.intent_route column present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lists'
      and column_name = 'idempotency_key'
  ),
  'lists.idempotency_key column present'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'menu_review_queue'
      and column_name = 'idempotency_key'
  ),
  'menu_review_queue.idempotency_key column present'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'menu_sessions_owner_idempotency_idx'),
  'menu_sessions_owner_idempotency_idx present'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'lists_owner_idempotency_idx'),
  'lists_owner_idempotency_idx present'
);

select ok(
  exists (select 1 from pg_indexes where indexname = 'menu_review_queue_owner_idempotency_idx'),
  'menu_review_queue_owner_idempotency_idx present'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_sessions'::regclass
      and conname = 'menu_sessions_idempotency_key_valid'
  ),
  'menu_sessions_idempotency_key_valid constraint present'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.lists'::regclass
      and conname = 'lists_idempotency_key_valid'
  ),
  'lists_idempotency_key_valid constraint present'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.menu_review_queue'::regclass
      and conname = 'menu_review_queue_idempotency_key_valid'
  ),
  'menu_review_queue_idempotency_key_valid constraint present'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'menu_create_session'
      and pg_function_is_visible(oid)
  ),
  'menu_create_session() function present'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'menu_create_list'
      and pg_function_is_visible(oid)
  ),
  'menu_create_list() function present'
);

select tests.create_supabase_user('menu-idempotency-stage3'::text) as owner_id \gset

-- free user claims for session creation
select set_config(
  'request.jwt.claims',
  json_build_object('app_metadata', json_build_object('is_menu_premium', false))::text,
  true
);

with session_key as (
  select 'menu-session-' || gen_random_uuid()::text as key
),
first_session as (
  select * from public.menu_create_session(
    (select key from session_key),
    null::text,
    'camera'::text,
    '{}'::jsonb,
    null::boolean
  )
),
second_session as (
  select * from public.menu_create_session(
    (select key from session_key),
    null::text,
    'camera'::text,
    '{}'::jsonb,
    null::boolean
  )
),
usage_after_session as (
  select uploads, list_creates
  from public.menu_usage_counters
  where owner_id = :'owner_id'::uuid
    and usage_date = (timezone('utc', now()))::date
)
select * from (
  select ok((select replay from first_session) = false, 'menu_create_session replay=false on first call')
  union all
  select ok((select replay from second_session) = true, 'menu_create_session replay=true on second call')
  union all
  select ok(
    (select session_id from first_session) = (select session_id from second_session),
    'menu_create_session returns stable session_id on replay'
  )
  union all
  select ok((select uploads from usage_after_session) = 1, 'menu_usage_counters.uploads increments once for session')
) as tap_results;

-- premium claims for list creation
select set_config(
  'request.jwt.claims',
  json_build_object('app_metadata', json_build_object('is_menu_premium', true))::text,
  true
);

with list_key as (
  select 'menu-list-' || gen_random_uuid()::text as key
),
items as (
  select jsonb_build_array(
    jsonb_build_object('label', 'Bananas', 'desired_qty', 2, 'notes', null),
    jsonb_build_object('label', 'Salt', 'desired_qty', 1, 'notes', '1 jar')
  ) as payload
),
first_list as (
  select * from public.menu_create_list((select key from list_key), 'Stage 3 list', (select payload from items))
),
second_list as (
  select * from public.menu_create_list((select key from list_key), 'Stage 3 list', (select payload from items))
),
usage_after_list as (
  select uploads, list_creates
  from public.menu_usage_counters
  where owner_id = :'owner_id'::uuid
    and usage_date = (timezone('utc', now()))::date
),
list_item_count as (
  select count(*)::int as cnt
  from public.list_items
  where list_id = (select list_id from first_list)
)
select * from (
  select ok((select replay from first_list) = false, 'menu_create_list replay=false on first call')
  union all
  select ok((select replay from second_list) = true, 'menu_create_list replay=true on second call')
  union all
  select ok(
    (select list_id from first_list) = (select list_id from second_list),
    'menu_create_list returns stable list_id on replay'
  )
  union all
  select ok((select list_creates from usage_after_list) = 1, 'menu_usage_counters.list_creates increments once for list')
  union all
  select ok((select cnt from list_item_count) = 2, 'menu_create_list inserts list_items once')
) as tap_results;

select finish();
rollback;
