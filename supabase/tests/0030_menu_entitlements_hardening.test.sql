begin;

select plan(4);

-- Enable dev-only behavior for this test run (non-production environment).
insert into public.app_runtime_config (key, value)
values ('app_environment', jsonb_build_object('name', 'development'))
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Enable the developer-only bypass (should only affect dev accounts).
insert into public.app_runtime_config (key, value)
values ('menu_dev_bypass', jsonb_build_object('enabled', true))
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Non-dev, non-premium user must NOT be treated as premium even if bypass is enabled.
select tests.create_supabase_user(
  'menu-non-dev'::text,
  jsonb_build_object('is_menu_premium', false)
) as non_dev_user_id \gset

select ok(public.menu_is_premium_user() = false, 'menu_dev_bypass does not elevate non-dev users');

-- Developer accounts are treated as premium only when menu_dev_bypass is enabled.
select tests.create_supabase_user(
  'menu-dev-user'::text,
  jsonb_build_object('is_menu_premium', false, 'is_developer', true)
) as dev_user_id \gset

select ok(public.menu_is_premium_user() = true, 'menu_dev_bypass elevates developer users');

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_recipes'
      and policyname = 'menu_recipes_premium_select'
  ),
  'menu_recipes_premium_select policy present'
);

-- Free-tier concurrent session cap is 1.
select set_config('request.jwt.claim.sub', :'non_dev_user_id'::text, true);
select set_config('request.jwt.claims', json_build_object('app_metadata', json_build_object('is_menu_premium', false))::text, true);

insert into public.menu_sessions (owner_id, status, idempotency_key)
values (:'non_dev_user_id'::uuid, 'processing', 'existing-session-' || gen_random_uuid()::text);

select throws_ok(
  $$select * from public.menu_create_session('new-session-' || gen_random_uuid()::text, null::text, 'camera'::text, '{}'::jsonb, null::boolean);$$,
  'concurrent_session_limit',
  'menu_create_session enforces concurrent session cap'
);

select finish();
rollback;
