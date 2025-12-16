# Runbook — Proper Implementation Workflow (Repo‑Wide)

This is the **repo-wide** workflow for building production-tier features without shortcuts. It complements:
- `AGENTS.md` (guardrails + repo gates)
- `docs/proper-implementation.md` (the quality bar + checklist)

If a feature has its own workflow runbook (example: `docs/runbooks/menu-feature-workflow.md`), follow that first.

## Non‑Negotiables
- Correctness > speed. No shortcuts that become production incidents later.
- No backdoors: no hidden admin paths, no hardcoded creds, no auth bypass in prod.
- Enforce security and limits **server-side** (RLS + Edge Functions); client gating is UX only.
- Design for retries/concurrency: idempotency keys, safe replay, versioning where needed.
- Observability from day 1: correlation IDs + typed errors + logs that never leak secrets.
- Docs/runbooks are part of Done.

## Session Start Checklist (every work session)

1) **Repo state**
- `git status`
- `git --no-pager log --oneline -n 30`
- Optional helper: `node scripts/session_start.mjs`

2) **Baseline docs (always)**
- `AGENTS.md`
- `docs/proper-implementation.md`
- `docs/setup.md` (env + emulator expectations)

3) **Pick the subsystem and read its runbook(s)**
- Mobile/Expo dev: `docs/runbooks/expo-metro-windows.md`
- Typecheck/runtime pitfalls: `docs/runbooks/typecheck-and-safe-fetch.md`
- Supabase overview: `supabase/README.md`
- Supabase CI checks: `docs/ci/supabase-verify.md`
- Menus/Recipes/AI: `docs/runbooks/menu-feature-workflow.md`
- Brand insights: `docs/runbooks/brand-insights-migration.md`

4) **Read *recent history* for what you will touch**
- Example:
  - `git --no-pager log --oneline -n 30 -- apps/mobile/src`
  - `git --no-pager log --oneline -n 30 -- supabase/functions supabase/migrations supabase/tests`

5) **Search before you build**
- `rg -n "<key terms>"` and read surrounding context to avoid duplicate implementations.

## Implementation Workflow (Production Tier)

### Phase 0 — Define the contract
Before writing code, write down (in the PR description or a short note in the relevant runbook):
- What’s the user-visible behavior?
- What server-side rules must be enforced?
- What’s the failure model (offline, timeouts, retries, partial success)?
- What are the typed error codes and the user-facing copy?
- What’s the idempotency key strategy for every mutating request?
- What data must be persisted locally (WatermelonDB) vs remotely (Supabase), and when?

### Phase 1 — Backend first (when security/correctness depends on it)
If the feature affects auth, limits, billing, data integrity, or multi-user concurrency:
1) Add/adjust **migrations** in `supabase/migrations/`.
2) Add/adjust **RLS policies** and server checks.
3) Update **Edge Functions** in `supabase/functions/`:
   - validate inputs
   - enforce authZ
   - require `Idempotency-Key` for retryable writes
   - include `correlationId` in *all* success/error responses
4) Add/adjust DB smoke tests in `supabase/tests/` and run:
   - `supabase db reset --workdir supabase`
   - `supabase test db --workdir supabase`

### Phase 2 — Client implementation (UX + offline + safe retries)
1) Add/adjust API calls (headers + typed errors + retries where appropriate).
2) Lock CTAs during in-flight requests; avoid double-submits.
3) Persist the right state locally (WatermelonDB) and define sync/refresh rules.
4) Ensure freemium/premium gating is consistent with server rules (client mirrors server).

### Phase 3 — Observability + safe debugging
1) Ensure every request sets:
   - `x-correlation-id`
   - `Idempotency-Key` (for retryable writes)
2) Ensure errors returned to the UI include:
   - stable `code`
   - `correlationId`
3) Logs must never include secrets/PII payloads; redact aggressively.

### Phase 4 — Docs, runbooks, and rollout
1) Update the relevant runbook(s) with:
   - setup steps
   - “how to verify” steps (copy/paste)
   - common failure modes + fixes
2) Add a rollout plan (flags, canary, rollback/kill-switch).
3) Ensure CI gates cover the change (don’t rely on “remembering”).

## Repo Gates (run before push)

JS/TS:
- `pnpm verify`
- Targeted: `pnpm --filter @smart-shopper/mobile typecheck`

Supabase (schema/tests):
- `supabase db reset --workdir supabase`
- `supabase test db --workdir supabase`

CI must be green:
- `.github/workflows/ci.yml`
- `.github/workflows/verify-supabase.yml`

## Secrets & Safety Rules (copy/paste safe)
- Never paste passwords/OTPs/JWTs/keys into chat/issues/PRs.
- When sharing logs, share only: `correlationId`, error `code`, timestamp, and sanitized request shape.
- Redact headers: `Authorization: Bearer <redacted>`.

## Definition of Done
Use the checklist in `AGENTS.md` and `docs/proper-implementation.md`.

