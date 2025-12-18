# Agent Guardrails (Read First)

This repo prioritizes correctness, resiliency, and production-readiness over speed. Avoid shortcuts that create instability under concurrent multi-user load.

## Security (non‑negotiable, no backdoors)
- Do **not** add hidden access paths (secret admin endpoints, debug screens, hardcoded credentials, “magic” headers, etc.).
- Do **not** bypass auth in production (no `verify_jwt = false`, no “accept userId as auth”, no service-role keys in clients).
- Any developer-only bypass must be:
  - explicitly flag-controlled (runtime config / build-time env),
  - default **off** for prod,
  - auditable (logs + code comments + runbook entry),
  - removed before public release if it reduces security posture.

## Session Start (do before coding)
- Optional helper: `node scripts/session_start.mjs` (prints repo state + reminders).
- Read `docs/README.md` (docs index + subsystem entry points).
- Read `docs/proper-implementation.md`.
- Read `docs/runbooks/proper-implementation-workflow.md` (repo-wide workflow).
- Read the task’s relevant docs/runbooks/plans (start with `docs/` and `docs/runbooks/`).
- Review recent history for the area you will touch (`git --no-pager log --oneline -n 30 -- <paths>`).
- Search for existing implementations first (`rg -n "<key terms>"`) and read the full surrounding context to avoid duplication/regressions.

## Project Map (where to look first)
- `apps/mobile/` — Expo React Native app (WatermelonDB + Supabase). Start with `docs/setup.md` and `docs/runbooks/expo-metro-windows.md`.
- `packages/core/` — shared domain logic (pricing/unit conversions, validation). Keep logic here reusable + testable.
- `packages/ui/`, `packages/theme/` — shared UI primitives + design tokens.
- `supabase/migrations/` — Postgres schema migrations (RLS, tables, policies).
- `supabase/tests/` — SQL smoke tests (run with `supabase test db`).
- `supabase/functions/` — Edge functions (Deno). Keep authZ server-side; require idempotency + correlation IDs.
- `docs/runbooks/` — operational runbooks (update alongside code changes; docs are part of Done).

## Repo Gates (copy/paste, run before you push)
### JS/TS (CI mirrors these)
- `pnpm verify`
- Targeted when iterating: `pnpm --filter @smart-shopper/mobile typecheck`

### Tests (run what you touched)
- Mobile: `pnpm --filter @smart-shopper/mobile test`
- Packages: `pnpm --filter @smart-shopper/core test`, `pnpm --filter @smart-shopper/ui test`, `pnpm --filter @smart-shopper/theming test`

### Supabase (schema + tests)
- Start local stack (Docker): `supabase start`
- Local schema apply: `supabase db reset`
- DB smoke tests: `supabase test db`
- Remote apply (manual, after review): `supabase db push`

### Supabase (functions packaging/deploy)
- Deploy a single function (bundles as part of deploy): `supabase functions deploy <function-name>`
- Deploy all functions: `supabase functions deploy`

### CI references (these must be green)
- `.github/workflows/ci.yml` (runs `pnpm verify`)
- `.github/workflows/verify-supabase.yml` (Supabase lint + edge function pings; see `docs/ci/supabase-verify.md`)

## Implementation Standard (non‑negotiable)
- Ship end-to-end production-tier changes: backend enforcement + client UX + tests + rollout/rollback plan.
- If feature A depends on feature B for correctness, build/verify B first (or gate A behind flags until B is production-ready).
- Enforce correctness server-side (RLS/edge functions/DB constraints); never rely on client-only gating for security or limits.
- Design for concurrency and retries: idempotency keys, optimistic locking/versioning where needed, safe replay behavior.
- Add observability from day 1: structured logs, correlation IDs, actionable error surfaces.
- Update docs/runbooks/contracts alongside code changes; documentation is part of Done.

## Definition of Done (enforced, not vibes)
- CI passes (`ci.yml` + `verify-supabase.yml`) and you ran the relevant local gates above.
- AuthZ is enforced server-side (RLS/policies/function checks) for any sensitive operation.
- Idempotency is required for retryable writes; safe replay returns deterministic results.
- Errors are typed (stable `code`) and all user-facing errors include a correlation ID.
- Runbooks updated for: setup, testing steps, deploy/rollback, and common failure modes.
- No secrets or tokens are introduced/printed/logged (see next section).

## Don’t Leak Secrets (how to share logs safely)
- Never paste: passwords, OTPs, JWTs, `Authorization` headers, service role keys, access/refresh tokens, private URLs.
- When asking for help, share **only**:
  - `correlationId` (preferred), function name, timestamp, error `code`, and sanitized request shape (no PII).
  - If you must show headers, redact values: `Authorization: Bearer <redacted>`.
- When writing logs: include `x-correlation-id`, but never log full tokens/OTPs/PII payloads.
