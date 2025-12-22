begin;

select plan(9);

select ok(
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'menu_title_dishes'),
  'menu_title_dishes table exists'
);

select ok(
  exists (
    select 1 from pg_proc
    where proname = 'menu_create_title_dish'
      and pg_function_is_visible(oid)
  ),
  'menu_create_title_dish() function present'
);

select tests.create_supabase_user(
  'menu-title-only'::text,
  jsonb_build_object('is_menu_premium', false)
) as owner_id \gset

-- NOTE: Separate "write" function calls from "read" assertions; see 0026_menu_idempotency_sessions_lists_reviews.test.sql.
select 'menu-title-' || gen_random_uuid()::text as title_key \gset

select
  dish_id as first_dish_id,
  replay as first_dish_replay
from public.menu_create_title_dish(:'title_key', 'Ackee and saltfish', null::uuid)
\gset

select
  dish_id as second_dish_id,
  replay as second_dish_replay
from public.menu_create_title_dish(:'title_key', 'Ackee and saltfish', null::uuid)
\gset

select ok(:'first_dish_replay'::boolean = false, 'menu_create_title_dish replay=false on first call');
select ok(:'second_dish_replay'::boolean = true, 'menu_create_title_dish replay=true on second call');
select ok(:'first_dish_id'::uuid = :'second_dish_id'::uuid, 'menu_create_title_dish returns stable dish_id on replay');

select is(
  (
    select uploads
    from public.menu_usage_counters
    where owner_id = :'owner_id'::uuid
      and usage_date = (timezone('utc', now()))::date
  ),
  1,
  'menu_usage_counters.uploads increments once for title-only save'
);

select throws_ok(
  $$select * from public.menu_create_title_dish('menu-title-empty', '   ', null::uuid);$$,
  'title_required',
  'menu_create_title_dish rejects empty titles'
);

-- Free-tier daily upload cap is 3; the 4th increment should fail.
select * from public.menu_create_title_dish('menu-title-2-' || gen_random_uuid()::text, 'Callaloo', null::uuid);
select * from public.menu_create_title_dish('menu-title-3-' || gen_random_uuid()::text, 'Festival', null::uuid);

select throws_ok(
  $$select * from public.menu_create_title_dish('menu-title-4-' || gen_random_uuid()::text, 'Jerk chicken', null::uuid);$$,
  'limit_exceeded',
  'menu_create_title_dish enforces daily upload cap'
);

select is(
  (select uploads from public.menu_usage_counters where owner_id = :'owner_id'::uuid and usage_date = (timezone('utc', now()))::date),
  3,
  'uploads remains at limit after over-limit attempt'
);

select finish();
rollback;
