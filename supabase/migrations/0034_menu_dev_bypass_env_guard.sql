-- Menu dev bypass environment guard (production safety)
-- Goals:
-- - Keep menu_dev_bypass on for dev/staging until rollout, but never in production.
-- - Default to "production" when environment is missing or unknown.

set check_function_bodies = off;

-- Runtime config defaults (safe to re-run).
insert into public.app_runtime_config (key, value)
values ('menu_dev_bypass', jsonb_build_object('enabled', true))
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

insert into public.app_runtime_config (key, value)
values ('app_environment', jsonb_build_object('name', 'production'))
on conflict (key) do nothing;

-- Premium checks must be server-driven and gated by environment.
create or replace function public.menu_is_premium_user()
returns boolean
language plpgsql
stable
as $$
declare
  claims jsonb := public.menu_jwt_claims();
  app_meta jsonb := coalesce(claims->'app_metadata', '{}'::jsonb);
  runtime_config jsonb := public.get_runtime_config('menu_dev_bypass');
  env_config jsonb := public.get_runtime_config('app_environment');
  env_name text := lower(coalesce(env_config->>'name', 'production'));
  dev_bypass_enabled boolean := coalesce((runtime_config->>'enabled')::boolean, false);
  is_premium boolean := coalesce((app_meta->>'is_menu_premium')::boolean, false);
  is_developer boolean := coalesce((app_meta->>'is_developer')::boolean, false)
    or coalesce((app_meta->>'dev')::boolean, false);
  allow_dev_bypass boolean := env_name <> 'production';
begin
  return is_premium
    or (dev_bypass_enabled and is_developer and allow_dev_bypass);
end;
$$;
