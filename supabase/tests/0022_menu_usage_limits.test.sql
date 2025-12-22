begin;

select plan(8);

-- setup: create a fresh auth user and set auth.uid() for this transaction
select tests.create_supabase_user('menu-usage-user'::text) as user_id \gset

-- ensure no row exists initially
select is(
  (select count(*) from public.menu_usage_counters where owner_id = :'user_id'),
  0::bigint,
  'usage counters start empty'
);

-- increment uploads within limit
select * from public.increment_menu_usage(:'user_id'::uuid, current_date, 1, 0, 3, 1);
select is(
  (select uploads from public.menu_usage_counters where owner_id = :'user_id' and usage_date = current_date),
  1,
  'usage counters records first upload'
);

-- increment list creates within limit
select * from public.increment_menu_usage(:'user_id'::uuid, current_date, 0, 1, 3, 1);
select is(
  (select list_creates from public.menu_usage_counters where owner_id = :'user_id' and usage_date = current_date),
  1,
  'usage counters records list create'
);

-- exceed upload limit (function returns empty set when the conflict update path would exceed limits)
select is(
  (select count(*) from public.increment_menu_usage(:'user_id'::uuid, current_date, 5, 0, 3, 1)),
  0,
  'increment returns empty when over limit'
);

-- ensure counts unchanged after failure
select is(
  (select uploads from public.menu_usage_counters where owner_id = :'user_id' and usage_date = current_date),
  1,
  'usage uploads unchanged after over-limit attempt'
);

-- higher limits allow larger increments
select * from public.increment_menu_usage(:'user_id'::uuid, current_date, 10, 2, 25, 25);
select is(
  (select uploads from public.menu_usage_counters where owner_id = :'user_id' and usage_date = current_date),
  11,
  'higher limit allows uploads increments'
);

select is(
  (select list_creates from public.menu_usage_counters where owner_id = :'user_id' and usage_date = current_date),
  3,
  'higher limit allows list creates increments'
);

-- auth mismatch should raise
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select throws_ok(
  $$select * from public.increment_menu_usage(:'user_id'::uuid, current_date, 1, 0, 3, 1);$$,
  'not_owner',
  'increment rejects non-owner'
);

select finish();
rollback;
