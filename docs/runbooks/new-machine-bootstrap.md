# New Machine Bootstrap (SSD Migration) + Session Prompt

Purpose: restore this project on a brand new machine with minimal risk of regressions.

Scope source: verified from repository files at commit `e094095` (`/mnt/c/ss`), including `docs/`, `scripts/`, `package.json`, `apps/mobile/*`, `supabase/*`, and CI workflows.

## 1. Pre-migration checklist (old machine, before SSD swap)

Copy these first (critical):
- Entire repo folder (including `.git`): `C:\ss` (or current repo root).
- `apps/mobile/.env` (not tracked by git; required for app runtime config).
- Any local env files you created manually:
  - `supabase/functions/collaboration/.env.local` (if used).
  - any custom local secret files you added outside git.
- Any release signing assets if you use production signing (not in this repo by default).
- Optional local tooling state if you want to avoid relinking:
  - Supabase CLI auth/session state (or plan to run `supabase login` again).
  - Android AVD images and SDK (can be reinstalled if needed).

Do not rely on these (safe to regenerate):
- `node_modules/`, `.pnpm-store/`, `.expo/`, build outputs, caches.

## 2. Required software on new machine

Install these first:
- Git.
- Node.js 20 LTS (CI uses Node 20; app minimum is `>=18`).
- Corepack + pnpm (`packageManager` is `pnpm@10.27.0`).
- Python 3.x (used by `scripts/jsx_sanity_check.py`; CI installs Python).
- Docker Desktop (required for local Supabase stack).
- Supabase CLI (latest is used in CI).
- Android Studio + Android emulator (primary test target for this repo).

Optional but used in this repo:
- Deno 2.x (for local `deno check` parity with CI).
- k6 (load tests in `scripts/load/*.k6.js`).
- Maestro CLI (mobile e2e path in menu runbook).

## 3. Recommended paths and shell

Use Windows PowerShell for Windows workflows.

Path recommendations:
- Repo path: `C:\ss` (short path avoids Android/Gradle path-length issues).
- WSL mirror path (if needed): `/mnt/c/ss`.

Important:
- Do not mix dependency installs between WSL and PowerShell for the same working tree.
- Repo `.npmrc` is authoritative at this commit:
  - `virtual-store-dir=.pnpm`
  - `virtual-store-dir-max-length=60`
  - `public-hoist-pattern[]=expo-modules-core`

## 4. Initial bootstrap commands (PowerShell)

From repo root:

```powershell
cd C:\ss
corepack enable
corepack prepare pnpm@10.27.0 --activate
pnpm install
pnpm verify
```

If prompted around build approvals after install, run:

```powershell
pnpm approve-builds
```

## 5. Mobile app env file (`apps/mobile/.env`)

Create/restore `apps/mobile/.env` with this template (fill real values):

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_MOCK_AUTH=false

EXPO_PUBLIC_FEATURE_NEW_NAV=false
EXPO_PUBLIC_FEATURE_CREATE_WORKFLOW=false
EXPO_PUBLIC_FEATURE_HEATMAP_V2=false
EXPO_PUBLIC_FEATURE_INVENTORY_VIEW=false
EXPO_PUBLIC_FEATURE_THEME_SELECTION=false
EXPO_PUBLIC_FEATURE_LIST_PARSER_V2=false
EXPO_PUBLIC_FEATURE_LIST_SHARING=false
EXPO_PUBLIC_FEATURE_AI_SUGGESTIONS=false
EXPO_PUBLIC_FEATURE_PROMO_NOTIFICATIONS=false

EXPO_PUBLIC_RECO_SERVICE_URL=
EXPO_PUBLIC_EXPO_PROJECT_ID=
EXPO_PUBLIC_NOTIFICATIONS_PROVIDER=expo
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

Notes:
- `apps/mobile/app.config.ts` reads the `EXPO_PUBLIC_*` values above into Expo `extra`.
- If `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing, mobile Supabase client does not initialize.
- Push requires a dev client build; Expo Go is not enough.
- `featureMenuDevFullAccess` exists in `apps/mobile/src/lib/env.ts` but is not sourced from `app.config.ts` at this commit; default behavior is `__DEV__`-based plus server/runtime gating.

## 6. Supabase local setup (Docker + CLI)

From repo root:

```powershell
cd C:\ss
supabase --version
supabase start
supabase db reset
supabase test db
```

From `supabase/config.toml` (local stack):
- Project id: `ss`
- API port: `54321`
- DB port: `54322`
- Studio port: `54323`
- Inbucket port: `54324`
- DB major version: `17`

Troubleshooting:
- If `supabase test db --debug` warns about `supabase\.temp\profile` missing, that warning is non-fatal.
- If you see `failed to read profile: Config File "config" Not Found in "[]"`, remove `supabase\.temp\profile`.
- Full details: `docs/runbooks/supabase-test-db-troubleshooting.md`.

Potential config mismatch to watch:
- `supabase/config.toml` currently references `./seed.sql`.
- Repo contains `supabase/seed/base_categories.sql` and no `supabase/seed.sql`.
- If `supabase db reset` errors on missing seed file, update seed config or add a wrapper seed file.

## 7. Supabase remote project bring-up

Known project ref used by current CI/docs:
- `itokvgjhtqzhrjlzazpm`

Link and push:

```powershell
cd C:\ss\supabase
supabase login
supabase link --project-ref itokvgjhtqzhrjlzazpm
supabase db push
```

Deploy functions:

```powershell
cd C:\ss
supabase functions deploy
```

## 8. Edge function secrets (remote Supabase)

Set all required function secrets in Supabase project settings.

Baseline:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY` (used in some functions/fallbacks)

Menus / LLM:
- `MENU_LLM_PROVIDER` (`custom` or `openai`; default logic falls back to `custom`)
- `MENU_LLM_URL` (required for `custom`)
- `MENU_LLM_API_KEY` (optional unless provider endpoint needs it)
- `MENU_LLM_MODEL` (required for `openai`)
- `MENU_LLM_BASE_URL` (optional; defaults to `https://api.openai.com/v1`)
- `MENU_LLM_TIMEOUT_MS` (optional; default `15000`)
- `MENU_PACKAGING_INTERNAL_KEY` (internal-only access key for `menus-packaging`)

Notifications:
- `NOTIFICATIONS_INTERNAL_KEY` (required; internal functions reject without it)
- `NOTIFICATIONS_PUSH_PROVIDER` (`expo`, `onesignal`, `auto`)
- `NOTIFICATIONS_ONESIGNAL_ENABLED` (`true`/`false`; hard kill switch)
- `ONESIGNAL_APP_ID` (if OneSignal enabled)
- `ONESIGNAL_REST_API_KEY` (if OneSignal enabled)
- `ONESIGNAL_ID_TYPE` (`player` or `subscription`)

Brand resolve hardening:
- `REQUIRE_AUTHENTICATED` (`true` enforces JWT role checks in `brand-resolve`)

## 9. Runtime config rows (DB)

`app_runtime_config` keys used by app/functions:
- `brand_insights`
- `menu_dev_bypass`
- `app_environment`

Relevant defaults from migrations:
- `brand_insights.enabled = true` (phase 0 migration)
- `menu_dev_bypass.enabled = true` (dev bypass key exists)
- `app_environment.name = production` (production-safe default)

For local/dev testing of menu bypass behavior, set environment explicitly:

```sql
insert into app_runtime_config (key, value)
values ('app_environment', jsonb_build_object('name', 'development'))
on conflict (key) do update
set value = excluded.value, updated_at = now();

insert into app_runtime_config (key, value)
values ('menu_dev_bypass', jsonb_build_object('enabled', true))
on conflict (key) do update
set value = excluded.value, updated_at = now();
```

## 10. Android + Expo startup

Start emulator from Android Studio AVD Manager, then from repo root:

```powershell
cd C:\ss
./scripts/kill-port.ps1 -Port 8081
pnpm --filter @smart-shopper/mobile start:clear -- --port 8081
pnpm --filter @smart-shopper/mobile android
```

If emulator cannot reach Metro (`SocketTimeoutException`):
- `--host tunnel` (most reliable), or
- `adb reverse tcp:8081 tcp:8081` with `--host localhost`.

Reference:
- `docs/runbooks/expo-metro-windows.md`

Known push behavior:
- Push registration code requires a physical device for token registration logic.
- OneSignal requires `EXPO_PUBLIC_ONESIGNAL_APP_ID` plus native plugin and rebuild.

## 11. Optional services

Recommendation service (FastAPI):

```powershell
cd C:\ss\services\recommendations
python -m venv .venv
. .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If used, set:
- `EXPO_PUBLIC_RECO_SERVICE_URL=http://<host>:8000`

Docker alternative:

```powershell
cd C:\ss\services\recommendations
docker build -t smartshopper-reco .
docker run --rm -p 8000:8000 smartshopper-reco
```

## 12. Validation gates after migration

Run these from repo root:

```powershell
pnpm verify
pnpm --filter @smart-shopper/mobile typecheck
pnpm --filter @smart-shopper/mobile test
pnpm --filter @smart-shopper/core test
pnpm --filter @smart-shopper/ui test
pnpm --filter @smart-shopper/theming test
```

Supabase validation:

```powershell
supabase start
supabase db reset
supabase test db
```

Menus function checks (as needed):

```powershell
deno check --config supabase/functions/deno.json supabase/functions/menus-policy/index.ts
deno check --config supabase/functions/deno.json supabase/functions/menus-llm/index.ts
```

Load/e2e optional:

```powershell
k6 run scripts/load/menus-llm.k6.js
k6 run scripts/load/menus-lists.k6.js
maestro test apps/mobile/e2e/maestro/menu-happy-path.yaml
```

## 13. CI and repo secrets to reconfigure (if needed)

GitHub workflows:
- `.github/workflows/ci.yml` (Node 20 + Python + `pnpm verify`)
- `.github/workflows/verify-supabase.yml` (Supabase local DB tests + Deno check + optional lint + function pings)

Repo secrets used by Supabase verify workflow:
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ANON_KEY`
- `SUPABASE_DB_URL` (optional for `supabase db lint`)

## 14. Known failure patterns and fast fixes

Metro/Expo on Windows:
- Use `docs/runbooks/expo-metro-windows.md`.
- Common fixes: clear caches, reinstall deps from PowerShell, ensure `metro-runtime` and `metro-resolver` in mobile package, free port 8081.

Typecheck issues from mixed environments:
- Use `docs/runbooks/typecheck-and-safe-fetch.md`.

Supabase db test oddities:
- Use `docs/runbooks/supabase-test-db-troubleshooting.md`.

Deno lockfile deploy mismatch:
- History shows Supabase deploy can reject newer Deno lock versions.
- Keep `supabase/functions/deno.lock` compatible with Supabase bundler; if deploy fails with lockfile-version error, regenerate lock with compatible Deno runtime before deploy.
- Reference incident notes in `docs/issue-log.md`.

## 15. Start-of-session prompt (copy/paste for future Codex sessions)

Use this prompt when starting a fresh coding session on the new machine:

```text
You are Codex, senior lead engineer for Smart Shopper.
Correctness > speed. No hallucinations: if not verified in repo, do not claim it.

Environment:
- Repo root: C:\ss (or /mnt/c/ss in WSL)
- Primary shell: PowerShell for Windows workflows
- Current branch: <fill>
- Current HEAD: <fill>

Mandatory start-of-session alignment:
1) Repo-wide search first for impacted modules/contracts/tests/docs.
2) Read AGENTS.md, docs/README.md, docs/proper-implementation.md, docs/runbooks/proper-implementation-workflow.md, docs/runbooks/senior-engineer-operating-prompt.md, docs/issue-log.md.
3) Read relevant subsystem runbooks (start with docs/runbooks/).
4) Inspect scripts/ to avoid duplicate tooling.
5) Review last ~40 commits for touched paths and identify last known good state.
6) Produce a short change plan (files, risks, validation steps) before edits.

Implementation rules:
- No partial fixes. Validate end-to-end.
- Server-side enforcement for auth/limits/integrity; client gating is UX only.
- Preserve production safety gates (no hidden bypasses, no service-role exposure in clients).
- For retryable writes: idempotency required and correlation IDs surfaced.
- Update runbooks/contracts/docs in same change.
- For meaningful bugs/regressions, append docs/issue-log.md with timestamp, root cause, fix, verification, and commit hash.

Validation gates before completion:
- pnpm verify
- Targeted package tests/typechecks for touched code
- If Supabase changed: supabase start, supabase db reset, supabase test db

When uncertain, verify in code/docs/logs instead of assuming.
```

## 16. Canonical references

Read these first in a new environment:
- `AGENTS.md`
- `docs/README.md`
- `docs/setup.md`
- `docs/proper-implementation.md`
- `docs/runbooks/proper-implementation-workflow.md`
- `docs/runbooks/senior-engineer-operating-prompt.md`
- `docs/runbooks/expo-metro-windows.md`
- `docs/runbooks/supabase-test-db-troubleshooting.md`
- `docs/issue-log.md`

