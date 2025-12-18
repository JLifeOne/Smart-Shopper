# Immediate Next Steps (Current Repo Reality)

This doc replaces older “bootstrap” notes. The repo is already a working monorepo with:
- Mobile: Expo React Native + TypeScript + WatermelonDB
- Backend: Supabase (Postgres + RLS + Edge Functions/Deno)
- CI: `pnpm verify` + Supabase DB smoke tests + Deno function typechecks

If you’re starting work, begin with:
- `AGENTS.md`
- `docs/proper-implementation.md`
- `docs/runbooks/proper-implementation-workflow.md`
- `docs/setup.md`

## 1) Always start with the gates (do this before push)
- `pnpm verify`
- If DB/schema changed: `supabase db reset --workdir supabase` and `supabase test db --workdir supabase`

CI must be green:
- `.github/workflows/ci.yml`
- `.github/workflows/verify-supabase.yml`

## 2) Ship “one slice” end‑to‑end

Pick a vertical slice and finish it fully (backend enforcement + UI + persistence + tests + runbook), then move on.

High‑impact slices aligned to the PRD:
- **Item Library**: pinned/recent/bundles, quick-add, add-to-list picker, offline-safe behavior.
- **Receipt ingestion**: capture → parse → validate → persist price points → update trends.
- **Store comparison**: unit normalization + cheapest-store chips + price history views.
- **Collaboration**: invites, roles, conflict handling, presence/activity.
- **Menu/Recipes (Premium)**: recipes cards, list conversion, idempotency, regenerate, persistence, training flags.

## 3) Security + resilience foundations (non‑negotiable)
- Server-side enforcement for authZ/limits (RLS + Edge Functions); client gating is UX only.
- Idempotency on all retryable write endpoints; safe replay behavior.
- Typed errors with `code` and `correlationId` everywhere (UI surfaces correlation IDs).
- No secrets in repo/logs; no “temporary” bypasses that can ship to prod.

## 4) Keep docs accurate
When behavior changes, update the relevant runbook in `docs/runbooks/` in the same PR.

Recommended docs to keep current:
- `docs/prd.md` (requirements)
- `docs/roadmap.md` (sequencing)
- `docs/setup.md` (developer onboarding)
- `docs/runbooks/*` (operational truth)

