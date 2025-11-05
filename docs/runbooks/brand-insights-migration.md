# Brand Insights Phase 0 Runbook

## Purpose

Document the steps to deploy and verify the Phase 0 schema changes that introduce brand-aware pricing support. Follow this runbook whenever you promote the migrations to a new environment (staging or production).

## Prerequisites

- Supabase CLI installed (`scoop install supabase` on Windows, `brew install supabase/tap/supabase` on macOS).
- Access to the target Supabase project with Owner privileges.
- Project reference ID (see **Project Settings → General** in the Supabase dashboard).
- Service role password for direct SQL access (see **Project Settings → Database**).

## Steps

### 1. Link the Supabase project (one time per workstation)

```powershell
supabase login                       # opens browser, create/paste personal access token
supabase link --project-ref <PROJECT_REF>
```

If linking fails due to permissions, export `SUPABASE_ACCESS_TOKEN` with a full-access token and rerun the command.

### 2. Apply migrations

```powershell
cd supabase
supabase db push
```

If the CLI cannot reach the management API, apply migrations manually in the SQL Editor:

1. Paste and run the contents of `migrations/0001_init.sql`.
2. Paste and run the contents of `migrations/0002_brand_phase0.sql`.

### 3. Smoke test the schema

Run the automated checks:

```powershell
supabase test db
```

These tests execute the SQL scripts in `supabase/tests/` and will fail if any required table or column is missing.

You can also spot-check:

```sql
select * from public.brands limit 1;
select * from public.brand_aliases limit 1;
select * from public.app_runtime_config;
```

### 4. Seed runtime configuration

Ensure the brand insights kill switch has an entry:

```sql
insert into app_runtime_config (key, value)
values ('brand_insights', jsonb_build_object('enabled', false))
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
```

Keep the flag `false` until the full pipeline is ready; flip to `true` during rollout.

### 5. Rollback plan

If deployment must be reverted:

1. Disable the feature via runtime config (`enabled` → `false`).
2. Reapply only `0001_init.sql` (if the environment predates Phase 0) or restore from backup.
3. Notify the mobile team to ship a hotfix if local schema state is inconsistent (`database.reset()` in the dev client).

## References

- Migration SQL: `supabase/migrations/`
- Schema validation tests: `supabase/tests/`
- Mobile backfill implementation: `apps/mobile/src/database/backfill/brand-backfill.ts`
- Runtime kill switch loader: `apps/mobile/src/lib/runtime-config.ts`

