# Menu Feature Workflow — Proper Implementation (Production Tier)

Context: Menu ingestion/recipes feature as of the latest review. Aligns with `docs/proper-implementation.md` and must meet resiliency, gating, and observability requirements. Use this workflow to plan and verify changes end-to-end; update status as work lands.

## Non‑Negotiables (read before coding)
- Correctness > speed. No shortcuts that create future instability under concurrent multi-user load.
- Read and follow `docs/proper-implementation.md` every session.
- Before changing anything: search for existing implementations and read the full surrounding context (docs, code, migrations, tests) to avoid duplication and regressions.
- If a feature depends on another for correctness, treat it as a production-tier dependency chain (backend enforcement + client UX + tests + rollout plan) — do not ship half a stack.

## Session start checklist (every work session)
1. Repo state: `git status` and `git --no-pager log --oneline -n 40`
2. Read docs (Menus + quality bar):
   - `docs/proper-implementation.md`
   - `docs/planning/menus-production-plan.md`
   - `docs/planning/menus-api-contracts.md`
   - `docs/runbooks/menu-feature-workflow.md`
3. Read recent history for touched areas (pick the relevant ones):
   - `git --no-pager log --oneline -n 40 -- apps/mobile/src/features/menus supabase/functions/menu-* supabase/migrations`
4. Locate existing code before adding new code: `rg -n "menu-(sessions|recipes|regenerate)|menus-(llm|lists|policy|pairings|reviews|titles)"`.

## System map (where things live)
- Mobile entry/UI: `apps/mobile/app/(app)/menus/index.tsx`
- Mobile hooks/api: `apps/mobile/src/features/menus/hooks.ts`, `apps/mobile/src/features/menus/api.ts`
- Mobile offline cache (WatermelonDB): `apps/mobile/src/database/menu-storage.ts`
- Runtime config (remote flags): `apps/mobile/src/lib/runtime-config.ts` (refreshed in `apps/mobile/src/context/auth-context.tsx`)
- DB schema/migrations: `supabase/migrations/0012_menu_core.sql`, `supabase/migrations/0019_menu_intel_foundation.sql`, `supabase/migrations/0020_menu_recipe_dietary.sql`, `supabase/migrations/0021_menu_recipes_idempotency.sql`, `supabase/migrations/0022_menu_usage_limits.sql`, `supabase/migrations/0026_menu_idempotency_sessions_lists_reviews.sql`, `supabase/migrations/0029_menu_title_only_sync.sql`, `supabase/migrations/0030_menu_entitlements_hardening.sql`, `supabase/migrations/0031_menu_reviews_dedupe.sql`, `supabase/migrations/0036_menu_freemium_limits.sql`, `supabase/migrations/0037_menu_freemium_total_limits.sql`
- DB tests: `supabase/tests/0012_menu_core.test.sql`, `supabase/tests/0021_menu_recipes_idempotency.test.sql`, `supabase/tests/0022_menu_usage_limits.test.sql`, `supabase/tests/0026_menu_idempotency_sessions_lists_reviews.test.sql`, `supabase/tests/0029_menu_title_only_sync.test.sql`, `supabase/tests/0030_menu_entitlements_hardening.test.sql`, `supabase/tests/0031_menu_reviews_dedupe.test.sql`, `supabase/tests/0037_menu_usage_totals.test.sql`
- Edge functions (Supabase):
  - Sessions: `supabase/functions/menu-sessions/index.ts`, `supabase/functions/menu-session-items/index.ts`
  - Policy/limits: `supabase/functions/menus-policy/index.ts`
  - Prompt: `supabase/functions/menus-llm/index.ts` (schemas in `supabase/functions/_shared/menu-prompt-types.ts`)
  - Recipes + regen + training: `supabase/functions/menu-recipes/index.ts`, `supabase/functions/menu-regenerate/index.ts`
  - Title-only: `supabase/functions/menus-titles/index.ts`
  - Conversion/pairings/reviews: `supabase/functions/menus-lists/index.ts`, `supabase/functions/menus-pairings/index.ts`, `supabase/functions/menus-reviews/index.ts`

## Scope (what it is)
- Capture menus/dishes (camera, gallery, or title-only), generate recipe cards and consolidated shopping lists, enforce entitlements (freemium total limits vs premium daily limits), and let users save, view, convert to lists, and flag cards for review.
- AI/ML wiring lives inside the Recipes card: auto-generate a recipe (via prompt) on first save of a dish, persist the generated recipe locally and in the DB for reuse (no re-prompt on every view), allow edits, and sync edits to storage + ML training data. Freemium can view the card only after upgrade; dev bypass stays on in dev while entitlements/idempotency harden, but must be removable for production rollout.

## Current Capabilities (Done)
- Capture & sessions: Upload via camera/gallery; sessions persisted; UI shows status, warnings, clarifications; can clear/refresh.
- Policy & gating: Menu policy fetched; freemium total caps and premium daily caps enforced client-side; dev bypass exists for dev builds (must remain removable/disabled outside dev).
- Recipes & cards: Saved dishes render as recipe cards; swipe viewer; add-to-list/create-list actions gated by plan limits; save combo; portions/people adjustment per card.
- Title-only flow: Title-only saves persist server-side (`/menus-titles`); freemium totals use `menu_usage_totals`, premium daily caps use `menu_usage_counters` (local cache + best-effort offline sync).
- List conversion: Menu → list conversion with consolidated lines; summary card shown; list creation gated by plan limits.
- Reviews: “Flag for review” posts to menus-reviews function; status/queue shown when available.
- Pairings: Suggested pairings rendered from API with fallback; save combo supported.
- Preferences: Dietary/allergen drafts stored and sent to policy update; applied to preview request payload.
- AI preview: Calls `menus-llm` to generate preview cards + consolidated list before saving; UI handles loading/error.
- Persistence/offline: Sessions, recipes, pairings, policy, reviews cached via menu-storage helpers; optimistic dish saves; UI state (open cards/highlights) persisted.
- Error handling: Typed `MenuFunctionError` with correlation IDs; retries/backoff for retryable failures in `apps/mobile/src/features/menus/api.ts`; menu viewer dismissal stabilized.
- Regeneration pipeline: `menu_recipes` tracks `origin`, `edited_by_user`, `needs_training`, `version`; `menu_recipe_training_queue` exists; `menu-regenerate` calls `menus-llm` and enqueues training when `needs_training` is set. Frontend calls `menu-regenerate` via `regenerateMenuRecipe()` in `apps/mobile/src/features/menus/api.ts`.

## Open gaps (AI/ML + platform)
- AI pipeline robustness: Better error surface + retry/backoff for menus-LLM, clarifications, preview failures; add correlation IDs and typed errors.
- Entitlements: Remove dev bypass in prod; harden server-side enforcement and consistent client gating for upload/prompt/convert/save.
- Idempotency/double-submit: Client sends `Idempotency-Key` and `x-correlation-id` (see `apps/mobile/src/features/menus/api.ts`); the server enforces replay-safety for sessions/lists/reviews/title-only saves and recipe writes. UI still needs consistent “in-flight” locking to prevent rapid repeats.
- Session resilience: Full restore of highlights/open cards/clarifications across restarts; ensure polling resumes; auto-refresh after clarifications.
- Preferences enforcement: Enforce dietary/allergen violations consistently in conversion/preview with actionable errors.
- Observability: Structured logs/metrics/traces for upload → prompt → convert → review; correlation IDs in UI errors; dashboards/alerts.
- Offline queueing: Title-only saves and reviews should queue/retry offline; background sync for menu artifacts.
- UI polish: Clarification UX, stronger empty/fallback states, conversion success flows, list/pairing actions wired to real APIs where placeholders remain.
- Data quality: Packaging guidance and ingredient lines sometimes stubbed; needs real backend/ML outputs.
- ML/AI evolution: Hook `menus-llm` to production model with guards (schema validation, hallucination checks); packaging normalizer; style/locale-aware outputs; trust/telemetry.
- Testing: Unit/integration/e2e for upload→prompt→convert, gating, limits, idempotency, and review flows; load/chaos tests for functions.

## Environment config — runtime flags
- `app_runtime_config` rows:
  - `app_environment`: `{ name: 'production' }` (default). Set to `development` or `staging` to permit dev bypass. Missing/unknown values are treated as production.
  - `brand_insights`: `{ enabled: true }` (default).
  - `menu_dev_bypass`: `{ enabled: true }` while building; only honored when `app_environment` is not `production`.
- Dev bypass on device requires BOTH:
  - Local build flag: `featureFlags.menuDevFullAccess` (see `apps/mobile/src/lib/env.ts`)
  - Remote runtime flag: `isMenuDevBypassEnabled()` (see `apps/mobile/src/lib/runtime-config.ts`)
  - Developer account (JWT claim): `user.app_metadata.is_developer` (or `dev`) so bypass never elevates non-dev users.
  - Current UI gate: `featureFlags.menuDevFullAccess && __DEV__ && isDeveloperAccount && isMenuDevBypassEnabled()` in `apps/mobile/app/(app)/menus/index.tsx`
- Backend enforcement (dev/staging only):
  - Premium checks are centralized in `public.menu_is_premium_user()` (see `supabase/migrations/0034_menu_dev_bypass_env_guard.sql`) and treat `menu_dev_bypass.enabled=true` as premium **only** for developer JWTs in non-production environments.
  - For production, keep `app_environment.name='production'` and set `menu_dev_bypass.enabled=false` before public release.
- SQL helper (run per environment):
  ```sql
  insert into app_runtime_config (key, value)
  values ('app_environment', jsonb_build_object('name', 'development'))
  on conflict (key) do update set value = excluded.value, updated_at = now();

  insert into app_runtime_config (key, value)
  values ('menu_dev_bypass', jsonb_build_object('enabled', true))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  ```
  Set `app_environment.name='production'` and `menu_dev_bypass.enabled=false` for prod before public release. Ensure `brand_insights` row exists.
- Developer test account flag (run with service role in dev/staging only):
  ```sql
  update auth.users
  set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{is_developer}',
    'true'::jsonb,
    true
  )
  where id = '<USER_UUID>';
  ```
- Client refresh: `AuthProvider` calls `refreshRuntimeConfig()` after session load; add a manual refresh hook before menu actions if runtime-config age is stale.

## Environment config — edge-function env (Menus AI + packaging)
- `MENU_LLM_PROVIDER`:
  - `custom` (default): `MENU_LLM_URL` must accept `MenuPromptInput` JSON and return `MenuPromptResponse` JSON.
  - `openai`: calls OpenAI-compatible `chat/completions` with `MENU_LLM_API_KEY`, `MENU_LLM_MODEL`, and optional `MENU_LLM_BASE_URL`.
- `MENU_LLM_TIMEOUT_MS`: hard timeout for downstream LLM calls (default 15000ms).
- `MENU_PACKAGING_INTERNAL_KEY`: internal-only secret for `/menus-packaging` writes (do not expose to clients); required only for packaging normalizer jobs/services.

## Idempotency & concurrency map (must be true before production rollout)
- Client defaults:
  - Auto-attaches `Idempotency-Key` for non-GET requests and `x-correlation-id` for all requests: `apps/mobile/src/features/menus/api.ts`
- Server enforcement (today):
  - Enforced: `menu-recipes` (POST/PUT/DELETE), `menu-regenerate` (POST), `menu-sessions` (POST), `menus-lists` (POST with `persistList: true`), `menus-reviews` (POST).
  - Implementation: DB-level uniqueness + atomic RPCs for session/list creation (`menu_create_session`, `menu_create_list`) and `menu_review_queue.idempotency_key` uniqueness to prevent duplicate review rows.
- DB support:
  - `menu_recipes` has `(owner_id, idempotency_key)` uniqueness + version bump trigger: `supabase/migrations/0021_menu_recipes_idempotency.sql`
  - `menu_sessions`, `lists`, and `menu_review_queue` also have `(owner_id, idempotency_key)` uniqueness: `supabase/migrations/0026_menu_idempotency_sessions_lists_reviews.sql`

## Regeneration & training contract
- Regenerate behavior: explicit user action per card triggers menus-LLM, writes the new recipe to Supabase with:
  - version bump (`version = previous + 1`)
  - `origin = 'llm_regen'`
  - `updated_at` set by the backend
  - persisted to WatermelonDB cache for offline reuse (no repeat prompts on reopen).
- Edits: user edits set `edited_by_user = true`, `origin = 'user_edit'`, and mark the recipe for training (`needs_training = true` or equivalent side table/flag). Save to Supabase and WatermelonDB optimistically; backend can consume flagged rows for ML training.
- Cache/read path: when viewing recipes, load from WatermelonDB/Supabase first; only call regenerate on explicit “Regenerate” CTA. Keep list/list-conversion flows using cached/persisted recipes unless regeneration was requested.
- Backend status: `menu_recipes` now has `origin`, `edited_by_user`, `needs_training`, `version`; `menu_recipe_training_queue` created; `menu-recipes` and `menu-regenerate` edge functions deployed (project `itokvgjhtqzhrjlzazpm`) and enqueue training when `needs_training` is set. Frontend now calls `menu-regenerate` (which invokes `menus-llm` and logs a `menu_regenerate` event with correlationId + durations).

## Observability (regen)
- `menu-regenerate` logs `menu_regenerate` and `menu_regenerate_llm_call` with `correlationId` (and `llmDurationMs`).
- `menus-llm` logs `menu_llm_call`/`menu_llm_stub` with `correlationId` for end-to-end traceability.
- Add dashboards/alerts on error rate and latency for `menu-regenerate`/`menus-llm` functions; surface correlationId in UI to trace failures end-to-end.

## Manual testing (PowerShell) — get JWT + call `menu-regenerate`
Note: some Supabase CLI versions do not support `supabase functions invoke`; use HTTPS calls instead.
Important PowerShell note: don’t type or paste the prompts `PS C:\ss>` or `>>` — those are **not** part of the command. If you ever see your prompt switch to `>>` unexpectedly, press `Ctrl+C` to cancel and get back to `PS C:\ss>` before trying again.

1) Fill these values (do not change the rest of the script):
   - `$projectRef`: Supabase project ref (e.g. `itokvgjhtqzhrjlzazpm`)
   - `$anonKey`: anon public key (Dashboard → Project Settings → API)
   - `$phoneE164`: phone number in E.164 (example: `+18762161033`)
   - `$otpCode`: the OTP you entered in the app (dev/test often `123456`)
   - `$recipeId`: a real `public.menu_recipes.id` owned by the JWT user

2) Get a JWT for the phone user:
   ```powershell
   $projectRef = "<PROJECT_REF>"
   $anonKey = "<ANON_KEY>"
   $phoneE164 = "<PHONE_E164>"  # e.g. "+18762161033"
   $otpCode = "<OTP_CODE>"      # e.g. "123456"

   $headers = @{ apikey = $anonKey; "Content-Type" = "application/json" }

   Invoke-RestMethod -Method POST -Uri "https://$projectRef.supabase.co/auth/v1/otp" `
     -Headers $headers `
     -Body (@{ phone = $phoneE164; channel = "sms" } | ConvertTo-Json -Compress)

   $session = Invoke-RestMethod -Method POST -Uri "https://$projectRef.supabase.co/auth/v1/verify" `
     -Headers $headers `
     -Body (@{ phone = $phoneE164; token = $otpCode; type = "sms" } | ConvertTo-Json -Compress)

   $jwt = $session.access_token
   ```

3) Confirm the JWT user matches the recipe owner:
   ```powershell
   $me = Invoke-RestMethod -Method GET -Uri "https://$projectRef.supabase.co/auth/v1/user" `
     -Headers @{ apikey = $anonKey; Authorization = "Bearer $jwt" }
   $me.id
   ```

4) Call `menu-regenerate` with idempotency + correlation IDs:
   ```powershell
   $recipeId = "<MENU_RECIPES_ID>"
   $fnUrl = "https://$projectRef.supabase.co/functions/v1/menu-regenerate"
   $idempotencyKey = "menu-regenerate-" + [guid]::NewGuid().ToString("N")

   $fnHeaders = @{
     apikey = $anonKey
     Authorization = "Bearer $jwt"
     "Content-Type" = "application/json"
     "Idempotency-Key" = $idempotencyKey
     "x-correlation-id" = "menu-regenerate-test-1"
   }

   $fnBody = @{
     recipeId = $recipeId
     sessionId = $null
     servings = 2
     title = "Test dish"
     cuisineStyle = "Jamaican"
   } | ConvertTo-Json -Compress

   try {
     Invoke-RestMethod -Method POST -Uri $fnUrl -Headers $fnHeaders -Body $fnBody | ConvertTo-Json -Depth 50
   } catch {
     $_.ErrorDetails.Message
   }
   ```

Expected errors:
- `limit_exceeded`: menu limit reached (`scope`: `uploads`, `list_creates`, `concurrent_sessions`), based on plan window (freemium lifetime vs premium daily).
- `recipe_not_found`: `recipeId` does not exist or is not owned by the JWT user.
- `idempotency_key_required`: missing `Idempotency-Key` header.

## Workflow Stages (execution order)
1) **Session resilience**
   - Status: ✅ Done
   - Deliver: Persist `sessionId` + session snapshot to storage; restore on app start; auto-refetch until terminal status; retain highlights/open cards/clarifications.
   - Exit: Restarting the app resumes polling and reflects server status without user action (session + UI state scoped per user on-device).
2) **Entitlements & limits enforcement**
   - Status: ✅ Done
   - Deliver: Enforce `menus-policy` (limits) on uploads, prompts, conversions, and list creation; allow all users full feature access while applying caps (freemium 3 total runs, premium 10 runs/day). Dev bypass is developer-only and removable/disabled in prod builds.
   - Exit: Limits are enforced server-side; users can still view previously saved recipes after hitting caps; prod builds ship with dev bypass off (and server bypass never elevates non-dev users).
3) **Idempotency & double-submit guards**
   - Status: ✅ Done
   - Deliver: Make every mutating operation replay-safe end-to-end:
     - Client: generate idempotency/correlation once per action and reuse across retries (see `apps/mobile/src/features/menus/api.ts`).
     - Server: enforce and persist idempotency keys for `menu-sessions`, `menus-lists`, and `menus-reviews` (and any other POST/DELETE that creates side effects).
     - UX: disable/lock buttons while a request is in-flight; surface correlationId on failures.
   - Exit: Retries/double-taps do not create duplicate sessions, lists, or review rows; server returns replay responses consistently.
4) **UX parity with spec**
   - Status: 🚧 In progress (core UX parity done; toast cleanup pending)
   - Deliver:
     - ✅ Wire “Scan a menu” CTA to start upload.
     - ✅ Add “Add all/Create list” affordance (bulk actions in the Recipes viewer).
     - ✅ Implement servings scale controls + per-card lock (opt-out from “Scale all”).
     - ✅ Add consolidated-list delta highlighting in the conversion summary.
     - ✅ Keep Recipes card inline edit/save for servings + packaging notes.
     - 🚧 Replace remaining critical toasts with in-UI banners/sheets where appropriate.
   - Exit: Users can start scans directly; list actions are obvious and spec-aligned.
5) **Observability & alerts**
   - Status: 🚧 In progress (structured logs shipped; dashboards/alerts pending)
   - Deliver: Structured logs + trace IDs for upload → session polling, prompt, conversion, clarify, review, preference violations; alerts on failures/latency spikes; surface correlation IDs in UI errors. Runbook: `docs/runbooks/menus-observability-and-alerts.md`.
   - Exit: Dashboards and alerts cover golden paths; failures are diagnosable (configure in Supabase/external log sink per runbook).
6) **Review & clarification robustness**
   - Status: ✅ Done
   - Deliver: Retry/backoff for review submissions; clear queue/resolve banners; re-poll after submit/resolve; debounce repeated review posts; handle clarify payload/options gracefully.
   - Exit: Users see reliable review/clarify states; no silent drops.
7) **Title-only sync & policy alignment**
   - Status: ✅ Done
   - Deliver: Account-scoped persistence (Supabase) for title-only saves and limits (freemium lifetime + premium daily); reconcile with library; disable local-only bypass if policy forbids.
   - Exit: Title-only behavior matches server policy across devices.
8) **Testing & QA**
   - Status: 🚧 In progress
   - Deliver: Unit tests for hooks (resume, gating, idempotency), UI render keys, conversion/clarify flows; e2e for upload→prompt→convert (happy/blocked); k6 load scripts for menus-llm + menus-lists; regression coverage for duplicate-key bug.
   - Exit: CI gates menu changes; key flows covered.

### Stage 4 test commands (copy/paste)
- Deno unit + integration (requires env + net): `deno test --config supabase/functions/deno.json --allow-env --allow-net supabase/functions/menus-llm/mod_test.ts`
- Maestro e2e: `maestro test apps/mobile/e2e/maestro/menu-happy-path.yaml`
- k6 load: `k6 run scripts/load/menus-llm.k6.js` and `k6 run scripts/load/menus-lists.k6.js`

## Testing commands (menus)
- Deno typecheck (single function): `deno check --config supabase/functions/deno.json supabase/functions/menus-llm/index.ts`
- Deno unit tests (menus-llm helpers): `deno test --config supabase/functions/deno.json supabase/functions/menus-llm/mod_test.ts`
- Maestro E2E: `maestro test apps/mobile/e2e/maestro/menu-happy-path.yaml`
- k6 load tests:
  - `k6 run scripts/load/menus-llm.k6.js`
  - `k6 run scripts/load/menus-lists.k6.js`

## Work Sequence (repeat per stage)
1. Context & dependencies: read the relevant docs/code in the System map; confirm what already exists; list dependencies and sequencing.
2. Design brief: inputs/outputs, failure modes, idempotency/concurrency, telemetry, flags, rollout/rollback.
3. Implement defensively: validation, timeouts/retries, typed errors, replay safety, server-side enforcement (don’t rely on client-only gating).
4. Observability: structured logs + correlation IDs; dashboards/alerts plan for the new/changed flow.
5. Tests & verification: add/extend unit/integration/e2e; run `pnpm --filter @smart-shopper/mobile test` and Supabase DB tests as applicable.
6. Update docs: keep this runbook + `docs/planning/menus-api-contracts.md` accurate; note remaining gaps explicitly if any work is intentionally deferred behind flags.

## Open Risks (track)
- Offline title-only saves may queue locally and later fail to sync if the cap is exceeded; ensure UX surfaces sync failures and upgrade prompts.
- Duplicate lists/pairings/sessions from double-submit.
- Lost session state after app restart causing orphaned uploads.
- Lack of observability hides ingestion/LLM/regeneration failures.
