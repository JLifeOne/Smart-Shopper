# Menu Feature Workflow — Current State & Next Actions

Context: Menu ingestion/recipes feature as of the latest review. Aligns with `docs/proper-implementation.md` and must meet resiliency, gating, and observability requirements. Use this workflow to plan and verify changes end-to-end; update status as work lands.

## Current Capabilities (Done)
- Menus inbox UI with upload options, preview overlay, dish save, pairings, conversion, clarifications, and review flagging wired to Supabase functions.
- Client prompt contract (`menus-llm`) and menu API clients implemented.
- Offline cache helpers for policy/recipes/pairings/reviews (session resume is incomplete).

## Workflow Stages (execution order)
1) **Session resilience**
   - Status: 🚧 In progress
   - Deliver: Persist `sessionId` + session snapshot to storage; restore on app start; auto-refetch until terminal status; retain highlights/open cards/clarifications.
   - Exit: Restarting the app resumes polling and reflects server status without user action. (Initial resume implemented in `useMenuSession`; highlight/open-card retention still to be validated.)
2) **Entitlements & limits enforcement**
   - Status: 🚧 In progress
   - Deliver: Enforce `menus-policy` (accessLevel, blurRecipes, limits) on uploads, prompts, conversions; block non-premium/over-limit locally and ensure server rejects; remove `__DEV__` bypass for gating.
   - Exit: Free users cannot call premium endpoints; limits respected even after storage clears. (Implementation pending.)
3) **Idempotency & double-submit guards**
   - Status: ❌ Not started
   - Deliver: Send idempotency keys for upload (per source/session), list conversion (selection hash), pairings (payload hash); UI shows “processing…” while pending to prevent rapid repeats.
   - Exit: Replays/double-taps do not create duplicate sessions/lists/pairings.
4) **UX parity with spec**
   - Status: 🚧 In progress
   - Deliver: Wire “Scan a menu” CTA to start upload; add “Add all/Create list” affordance; implement card lock/rotation, consolidated-list delta highlighting; reusable entry points instead of toasts.
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
