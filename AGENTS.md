# Agent Guardrails (Read First)

This repo prioritizes correctness, resiliency, and production-readiness over speed. Avoid shortcuts that create instability under concurrent multi-user load.

## Session Start (do before coding)
- Read `docs/proper-implementation.md`.
- Read the task’s relevant docs/runbooks/plans (start with `docs/` and `docs/runbooks/`).
- Review recent history for the area you will touch (`git --no-pager log --oneline -n 30 -- <paths>`).
- Search for existing implementations first (`rg -n "<key terms>"`) and read the full surrounding context to avoid duplication/regressions.

## Implementation Standard (non‑negotiable)
- Ship end-to-end production-tier changes: backend enforcement + client UX + tests + rollout/rollback plan.
- If feature A depends on feature B for correctness, build/verify B first (or gate A behind flags until B is production-ready).
- Enforce correctness server-side (RLS/edge functions/DB constraints); never rely on client-only gating for security or limits.
- Design for concurrency and retries: idempotency keys, optimistic locking/versioning where needed, safe replay behavior.
- Add observability from day 1: structured logs, correlation IDs, actionable error surfaces.
- Update docs/runbooks/contracts alongside code changes; documentation is part of Done.

