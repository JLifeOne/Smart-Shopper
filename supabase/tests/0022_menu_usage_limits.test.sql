begin;

select plan(8);

-- setup: create user
select tests.create_supabase_user('menu-usage-user'::text) as user_id \gset

-- ensure no row exists initially
select is(
  (select count(*) from public.menu_usage_counters where owner_id = :'user_id'),
  0,
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

-- exceed upload limit (expect failure)
select throws_ok(
  $$select * from public.increment_menu_usage(:'user_id'::uuid, current_date, 5, 0, 3, 1);$$,
  'limit_exceeded',
  'increment rejects uploads above limit'
);

-- ensure counts unchanged after failure
select is(
  (select uploads from public.menu_usage_counters where owner_id = :'user_id' and usage_date = current_date),
  1,
  'usage uploads unchanged after over-limit attempt'
);

-- premium limits higher
select tests.create_supabase_user('menu-usage-premium'::text) as premium_user \gset
select * from public.increment_menu_usage(:'premium_user'::uuid, current_date, 10, 2, 25, 25);
select is(
  (select uploads from public.menu_usage_counters where owner_id = :'premium_user' and usage_date = current_date),
  10,
  'premium user uploads tracked'
);

select finish();
rollback;
