# Menu Feature Workflow — Current State & Next Actions

Context: Menu ingestion/recipes feature as of the latest review. Aligns with `docs/proper-implementation.md` and must meet resiliency, gating, and observability requirements. Use this workflow to plan and verify changes end-to-end; update status as work lands.

## Scope (what it is)
- Capture menus/dishes (camera, gallery, or title-only), generate recipe cards and consolidated shopping lists, enforce entitlements (premium vs title-only), and let users save, view, convert to lists, and flag cards for review.
- AI/ML wiring lives inside the Recipes card: auto-generate a recipe (via prompt) on first save of a dish, persist the generated recipe locally and in the DB for reuse (no re-prompt on every view), allow edits, and sync edits to storage + ML training data. Freemium can view the card only after upgrade; dev bypass stays on in dev while entitlements/idempotency harden, but must be removable for production rollout.

## Current Capabilities (Done)
- Capture & sessions: Upload via camera/gallery; sessions persisted; UI shows status, warnings, clarifications; can clear/refresh.
- Policy & gating: Menu policy fetched; premium/title-only limits and daily caps enforced client-side; dev bypass flag in place.
- Recipes & cards: Saved dishes render as recipe cards; swipe viewer; add-to-list/create-list actions (premium); save combo; portions/people adjustment per card.
- Title-only flow: Non-premium can save titles; daily limit tracked in AsyncStorage; limit prompts shown.
- List conversion: Menu → list conversion with consolidated lines; summary card shown; list creation gated by limits/premium.
- Reviews: “Flag for review” posts to menus-reviews function; status/queue shown when available.
- Pairings: Suggested pairings rendered from API with fallback; save combo supported.
- Preferences: Dietary/allergen drafts stored and sent to policy update; applied to preview request payload.
- AI preview: Calls `menus-llm` to generate preview cards + consolidated list before saving; UI handles loading/error.
- Persistence/offline: Sessions, recipes, pairings, policy, reviews cached via menu-storage helpers; optimistic dish saves; UI state (open cards/highlights) persisted.
- Error handling: Toasts for limits/policy missing/premium gating; some limit/pref-violation handling; menu viewer dismissal stabilized.
- Regeneration backend: `menu_recipes` has `origin`, `edited_by_user`, `needs_training`, `version`; `menu_recipe_training_queue` created; `menu-recipes` and `menu-regenerate` edge functions deployed (project `itokvgjhtqzhrjlzazpm`) and enqueue training when `needs_training` is set. Frontend wiring to `menu-regenerate` is pending (currently uses client-side prompt).

## Open gaps (AI/ML + platform)
- AI pipeline robustness: Better error surface + retry/backoff for menus-LLM, clarifications, preview failures; add correlation IDs and typed errors.
- Entitlements: Remove dev bypass in prod; harden server-side enforcement and consistent client gating for upload/prompt/convert/save.
- Idempotency/double-submit: Idempotency keys across uploads/prompt/list conversion/reviews; UI locks to prevent rapid repeats.
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
- SQL helper (run per environment):
  ```sql
  insert into app_runtime_config (key, value)
  values ('menu_dev_bypass', jsonb_build_object('enabled', true))
  on conflict (key) do update set value = excluded.value, updated_at = now();
  ```
  Set `enabled` to `false` for prod before public release. Ensure `brand_insights` row exists.
- Client refresh: `AuthProvider` calls `refreshRuntimeConfig()` after session load; add a manual refresh hook before menu actions if runtime-config age is stale.

## Regeneration & training contract
- Regenerate behavior: explicit user action per card triggers menus-LLM, writes the new recipe to Supabase with:
  - version bump (`version = previous + 1`)
  - `origin = 'llm_regen'`
  - `updated_at` set by the backend
  - persisted to WatermelonDB cache for offline reuse (no repeat prompts on reopen).
- Edits: user edits set `edited_by_user = true`, `origin = 'user_edit'`, and mark the recipe for training (`needs_training = true` or equivalent side table/flag). Save to Supabase and WatermelonDB optimistically; backend can consume flagged rows for ML training.
- Cache/read path: when viewing recipes, load from WatermelonDB/Supabase first; only call regenerate on explicit “Regenerate” CTA. Keep list/list-conversion flows using cached/persisted recipes unless regeneration was requested.
- Backend status: `menu_recipes` now has `origin`, `edited_by_user`, `needs_training`, `version`; `menu_recipe_training_queue` created; `menu-recipes` and `menu-regenerate` edge functions deployed (project `itokvgjhtqzhrjlzazpm`) and enqueue training when `needs_training` is set. Frontend must call `menu-regenerate` for regen instead of client-only flow (pending).
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
   - Status: ❌ Not started
   - Deliver: Send idempotency keys for upload (per source/session), recipe-generation prompt, list conversion (selection hash), pairings (payload hash), reviews; UI shows “processing…” while pending to prevent rapid repeats.
   - Exit: Replays/double-taps do not create duplicate sessions/lists/pairings.
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
1. Design brief: inputs/outputs, failure modes, idempotency, telemetry, flags.
2. Implement defensively (timeouts, retries, typed errors, validation).
3. Add logging/metrics/traces and wire UI to show actionable errors.
4. Add/extend tests; run locally (`pnpm --filter @smart-shopper/mobile test` + e2e once available).
5. Document exit criteria updates in this file; ship behind flags where needed.

## Open Risks (track)
- Users bypassing premium/limits by clearing local storage.
- Duplicate lists/pairings/sessions from double-submit.
- Lost session state after app restart causing orphaned uploads.
- Lack of observability hides ingestion/LLM/regeneration failures.
