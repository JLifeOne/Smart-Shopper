begin;

select plan(8);

select tests.create_supabase_user('menu-usage-totals-user'::text) as user_id \gset

select is(
  (select count(*) from public.menu_usage_totals where owner_id = :'user_id'),
  0::bigint,
  'usage totals start empty'
);

select * from public.increment_menu_usage_total(:'user_id'::uuid, 1, 0, 3, 3);
select is(
  (select uploads_total from public.menu_usage_totals where owner_id = :'user_id'),
  1,
  'usage totals records first upload'
);

select * from public.increment_menu_usage_total(:'user_id'::uuid, 0, 1, 3, 3);
select is(
  (select list_creates_total from public.menu_usage_totals where owner_id = :'user_id'),
  1,
  'usage totals records list create'
);

select is(
  (select count(*) from public.increment_menu_usage_total(:'user_id'::uuid, 5, 0, 3, 3)),
  0::bigint,
  'increment returns empty when over limit'
);

select is(
  (select uploads_total from public.menu_usage_totals where owner_id = :'user_id'),
  1,
  'usage totals unchanged after over-limit attempt'
);

select * from public.increment_menu_usage_total(:'user_id'::uuid, 10, 2, 25, 25);
select is(
  (select uploads_total from public.menu_usage_totals where owner_id = :'user_id'),
  11,
  'higher limit allows uploads increments'
);

select is(
  (select list_creates_total from public.menu_usage_totals where owner_id = :'user_id'),
  3,
  'higher limit allows list creates increments'
);

select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select throws_ok(
  format(
    $$select * from public.increment_menu_usage_total(%L::uuid, 1, 0, 3, 3);$$,
    :'user_id'
  ),
  'not_owner',
  'increment rejects non-owner'
);

select finish();
rollback;
