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

-- NOTE: These tests intentionally separate "write" function calls from "read" assertions.
-- Postgres statement snapshots mean writes performed inside a function may not be visible
-- to other CTEs in the *same* SQL statement. Using separate statements avoids flaky NULL reads.
select 'menu-session-' || gen_random_uuid()::text as session_key \gset

select
  session_id as first_session_id,
  replay as first_session_replay
from public.menu_create_session(
  :'session_key',
  null::text,
  'camera'::text,
  '{}'::jsonb,
  null::boolean
)
\gset

select
  session_id as second_session_id,
  replay as second_session_replay
from public.menu_create_session(
  :'session_key',
  null::text,
  'camera'::text,
  '{}'::jsonb,
  null::boolean
)
\gset

select ok(:'first_session_replay'::boolean = false, 'menu_create_session replay=false on first call');
select ok(:'second_session_replay'::boolean = true, 'menu_create_session replay=true on second call');
select ok(:'first_session_id'::uuid = :'second_session_id'::uuid, 'menu_create_session returns stable session_id on replay');

select is(
  (
    select uploads_total
    from public.menu_usage_totals
    where owner_id = :'owner_id'::uuid
  ),
  1,
  'menu_usage_totals.uploads_total increments once for session'
);

-- list creation should be allowed for free users (within limits)

select 'menu-list-' || gen_random_uuid()::text as list_key \gset

select jsonb_build_array(
  jsonb_build_object('label', 'Bananas', 'desired_qty', 2, 'notes', null),
  jsonb_build_object('label', 'Salt', 'desired_qty', 1, 'notes', '1 jar')
) as list_items \gset

select
  list_id as first_list_id,
  replay as first_list_replay
from public.menu_create_list(:'list_key', 'Stage 3 list', :'list_items'::jsonb)
\gset

select
  list_id as second_list_id,
  replay as second_list_replay
from public.menu_create_list(:'list_key', 'Stage 3 list', :'list_items'::jsonb)
\gset

select ok(:'first_list_replay'::boolean = false, 'menu_create_list replay=false on first call');
select ok(:'second_list_replay'::boolean = true, 'menu_create_list replay=true on second call');
select ok(:'first_list_id'::uuid = :'second_list_id'::uuid, 'menu_create_list returns stable list_id on replay');

select is(
  (
    select list_creates_total
    from public.menu_usage_totals
    where owner_id = :'owner_id'::uuid
  ),
  1,
  'menu_usage_totals.list_creates_total increments once for list'
);

select is(
  (select count(*)::int from public.list_items where list_id = :'first_list_id'::uuid),
  2,
  'menu_create_list inserts list_items once'
);

select finish();
rollback;
