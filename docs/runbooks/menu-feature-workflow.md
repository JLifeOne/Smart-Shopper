# Menu Feature Workflow — Proper Implementation (Production Tier)

Context: Menu ingestion/recipes feature as of the latest review. Aligns with `docs/proper-implementation.md` and must meet resiliency, gating, and observability requirements. Use this workflow to plan and verify changes end-to-end; update status as work lands.

## Non‑Negotiables (read before coding)
- Correctness > speed. No shortcuts that create future instability under concurrent multi-user load.
- Read and follow `docs/proper-implementation.md` every session.
- Before changing anything: search for existing implementations and read the full surrounding context (docs, code, migrations, tests) to avoid duplication and regressions.
- If a feature depends on another for correctness, treat it as a production-tier dependency chain (backend enforcement + client UX + tests + rollout plan) — do not ship half a stack.

## Session start checklist (every work session)
1. Repo state: `git status` and `git --no-pager log --oneline -n 30`
2. Read docs (Menus + quality bar):
   - `docs/proper-implementation.md`
   - `docs/planning/menus-production-plan.md`
   - `docs/planning/menus-api-contracts.md`
   - `docs/runbooks/menu-feature-workflow.md`
3. Read recent history for touched areas (pick the relevant ones):
   - `git --no-pager log --oneline -n 30 -- apps/mobile/src/features/menus supabase/functions/menu-* supabase/migrations`
4. Locate existing code before adding new code: `rg -n "menu-(sessions|recipes|regenerate)|menus-(llm|lists|policy|pairings|reviews)"`.

## System map (where things live)
- Mobile entry/UI: `apps/mobile/app/(app)/menus/index.tsx`
- Mobile hooks/api: `apps/mobile/src/features/menus/hooks.ts`, `apps/mobile/src/features/menus/api.ts`
- Mobile offline cache (WatermelonDB): `apps/mobile/src/database/menu-storage.ts`
- Runtime config (remote flags): `apps/mobile/src/lib/runtime-config.ts` (refreshed in `apps/mobile/src/context/auth-context.tsx`)
- DB schema/migrations: `supabase/migrations/0012_menu_core.sql`, `supabase/migrations/0019_menu_intel_foundation.sql`, `supabase/migrations/0020_menu_recipe_dietary.sql`, `supabase/migrations/0021_menu_recipes_idempotency.sql`, `supabase/migrations/0025_menu_recipes_training_flags.sql`
- DB tests: `supabase/tests/0012_menu_core.test.sql`, `supabase/tests/0021_menu_recipes_idempotency.test.sql`
- Edge functions (Supabase):
  - Sessions: `supabase/functions/menu-sessions/index.ts`, `supabase/functions/menu-session-items/index.ts`
  - Policy/limits: `supabase/functions/menus-policy/index.ts`
  - Prompt: `supabase/functions/menus-llm/index.ts` (schemas in `supabase/functions/_shared/menu-prompt-types.ts`)
  - Recipes + regen + training: `supabase/functions/menu-recipes/index.ts`, `supabase/functions/menu-regenerate/index.ts`
  - Conversion/pairings/reviews: `supabase/functions/menus-lists/index.ts`, `supabase/functions/menus-pairings/index.ts`, `supabase/functions/menus-reviews/index.ts`

## Scope (what it is)
- Capture menus/dishes (camera, gallery, or title-only), generate recipe cards and consolidated shopping lists, enforce entitlements (premium vs title-only), and let users save, view, convert to lists, and flag cards for review.
- AI/ML wiring lives inside the Recipes card: auto-generate a recipe (via prompt) on first save of a dish, persist the generated recipe locally and in the DB for reuse (no re-prompt on every view), allow edits, and sync edits to storage + ML training data. Freemium can view the card only after upgrade; dev bypass stays on in dev while entitlements/idempotency harden, but must be removable for production rollout.

## Current Capabilities (Done)
- Capture & sessions: Upload via camera/gallery; sessions persisted; UI shows status, warnings, clarifications; can clear/refresh.
- Policy & gating: Menu policy fetched; premium/title-only limits and daily caps enforced client-side; dev bypass exists for dev builds (must remain removable/disabled outside dev).
- Recipes & cards: Saved dishes render as recipe cards; swipe viewer; add-to-list/create-list actions (premium); save combo; portions/people adjustment per card.
- Title-only flow: Non-premium can save titles; daily limit tracked in AsyncStorage; limit prompts shown.
- List conversion: Menu → list conversion with consolidated lines; summary card shown; list creation gated by limits/premium.
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
- Idempotency/double-submit: Client sends `Idempotency-Key` and `x-correlation-id` (see `apps/mobile/src/features/menus/api.ts`), but server-side idempotency is still missing on some mutating endpoints (`menu-sessions`, `menus-lists`, `menus-reviews`). UI also needs consistent “in-flight” locking to prevent rapid repeats.
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
  - `brand_insights`: `{ enabled: true }` (default).
  - `menu_dev_bypass`: `{ enabled: true }` in dev/staging; `{ enabled: false }` in prod.
- Dev bypass on device requires BOTH:
  - Local build flag: `featureFlags.menuDevFullAccess` (see `apps/mobile/src/lib/env.ts`)
  - Remote runtime flag: `isMenuDevBypassEnabled()` (see `apps/mobile/src/lib/runtime-config.ts`)
  - Current UI gate: `featureFlags.menuDevFullAccess && __DEV__ && isMenuDevBypassEnabled()` in `apps/mobile/app/(app)/menus/index.tsx`
- Backend enforcement (dev/staging only):
  - `menu_create_session` / `menu_create_list` / `menu-regenerate` treat `menu_dev_bypass.enabled=true` as premium for gating/limits; ensure it is `false` in production.
- SQL helper (run per environment):
  ```sql
  insert into app_runtime_config (key, value)
  values ('menu_dev_bypass', jsonb_build_object('enabled', true))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  ```
  Set `enabled` to `false` for prod before public release. Ensure `brand_insights` row exists.
- Client refresh: `AuthProvider` calls `refreshRuntimeConfig()` after session load; add a manual refresh hook before menu actions if runtime-config age is stale.

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
- `policy_blocked`: user is not premium and `menu_dev_bypass.enabled` is not true.
- `recipe_not_found`: `recipeId` does not exist or is not owned by the JWT user.
- `idempotency_key_required`: missing `Idempotency-Key` header.

## Workflow Stages (execution order)
1) **Session resilience**
   - Status: 🚧 In progress
   - Deliver: Persist `sessionId` + session snapshot to storage; restore on app start; auto-refetch until terminal status; retain highlights/open cards/clarifications.
   - Exit: Restarting the app resumes polling and reflects server status without user action. (Initial resume implemented in `useMenuSession`; highlight/open-card retention still to be validated.)
2) **Entitlements & limits enforcement**
   - Status: 🚧 In progress
   - Deliver: Enforce `menus-policy` (accessLevel, blurRecipes, limits) on uploads, prompts, conversions, recipe fetch/edit; block non-premium/over-limit locally and ensure server rejects. Keep dev bypass for local work; make it removable/disabled in prod builds when ready to ship.
   - Exit: Free users cannot call premium endpoints or view Recipes card until upgrade; limits respected even after storage clears; prod builds ship with dev bypass off.
3) **Idempotency & double-submit guards**
   - Status: ✅ Done
   - Deliver: Make every mutating operation replay-safe end-to-end:
     - Client: generate idempotency/correlation once per action and reuse across retries (see `apps/mobile/src/features/menus/api.ts`).
     - Server: enforce and persist idempotency keys for `menu-sessions`, `menus-lists`, and `menus-reviews` (and any other POST/DELETE that creates side effects).
     - UX: disable/lock buttons while a request is in-flight; surface correlationId on failures.
   - Exit: Retries/double-taps do not create duplicate sessions, lists, or review rows; server returns replay responses consistently.
4) **UX parity with spec**
   - Status: 🚧 In progress
   - Deliver: Wire “Scan a menu” CTA to start upload; add “Add all/Create list” affordance; implement card lock/rotation, consolidated-list delta highlighting; reusable entry points instead of toasts; ensure Recipes card shows generated content in-place and supports inline edit/save.
   - Exit: Users can start scans directly; list actions are obvious and spec-aligned.
5) **Observability & alerts**
   - Status: ❌ Not started
   - Deliver: Structured logs + metrics + trace IDs for upload → session polling, prompt, conversion, clarify, review, preference violations; alerts on failures/latency spikes; surface correlation IDs in UI errors.
   - Exit: Dashboards and alerts cover golden paths; failures are diagnosable.
6) **Review & clarification robustness**
   - Status: ❌ Not started
   - Deliver: Retry/backoff for review submissions; clear queue/resolve banners; re-poll after submit/resolve; debounce repeated review posts; handle clarify payload/options gracefully.
   - Exit: Users see reliable review/clarify states; no silent drops.
7) **Title-only sync & policy alignment**
   - Status: ❌ Not started
   - Deliver: Account-scoped persistence (Supabase) for title-only saves and daily limits; reconcile with library; disable local-only bypass if policy forbids.
   - Exit: Title-only behavior matches server policy across devices.
8) **Testing & QA**
   - Status: ❌ Not started
   - Deliver: Unit tests for hooks (resume, gating, idempotency), UI render keys, conversion/clarify flows; e2e for upload→prompt→convert (happy/blocked); regression coverage for duplicate-key bug.
   - Exit: CI gates menu changes; key flows covered.

## Work Sequence (repeat per stage)
1. Context & dependencies: read the relevant docs/code in the System map; confirm what already exists; list dependencies and sequencing.
2. Design brief: inputs/outputs, failure modes, idempotency/concurrency, telemetry, flags, rollout/rollback.
3. Implement defensively: validation, timeouts/retries, typed errors, replay safety, server-side enforcement (don’t rely on client-only gating).
4. Observability: structured logs + correlation IDs; dashboards/alerts plan for the new/changed flow.
5. Tests & verification: add/extend unit/integration/e2e; run `pnpm --filter @smart-shopper/mobile test` and Supabase DB tests as applicable.
6. Update docs: keep this runbook + `docs/planning/menus-api-contracts.md` accurate; note remaining gaps explicitly if any work is intentionally deferred behind flags.

## Open Risks (track)
- Users bypassing premium/limits by clearing local storage.
- Duplicate lists/pairings/sessions from double-submit.
- Lost session state after app restart causing orphaned uploads.
- Lack of observability hides ingestion/LLM/regeneration failures.
