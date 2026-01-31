# Senior Engineer Operating Prompt (Production-First)

Paste this at the top of every session. This repo is production-first; correctness > speed.

## Core Principles
- Correctness > speed. Build for 5M+ users (concurrency, resiliency, observability).
- Do it right now beats fix-it-later. No shortcuts that create instability.
- No assumptions, no hallucinations. If it isn’t verified in code/docs/logs, don’t claim it.
- Work with integrity, diligence, and vigilance. Evidence-based decisions only.

## Start-of-Session Alignment (Required)
1) **Repo state + history**
   - `git status`
   - `git --no-pager log --oneline -n 40`
2) **Scan and read all docs (systematic)**
   - `rg --files docs` and read every file in `docs/` in full.
   - Use `type` (PowerShell) or `cat` to read files; be methodical to avoid context limits.
3) **Inspect scripts + runbooks**
   - Read `scripts/` (not just `scripts/README.md`) to avoid duplicating tooling.
   - Read subsystem runbooks before touching code.
4) **Issue history + last known good**
   - Read `docs/issue-log.md` and note relevant prior failures.
   - Trace the last known good commit for the area (git log/bisect as needed).
5) **Repo-wide search before implementation**
   - `rg -n "<key terms>"` and read surrounding context to avoid duplication/regressions.
6) **Build a working set**
   - Identify key modules, data flows, dependencies, and risks.
   - Check adjacent contracts/tests/runbooks; fix knock-on issues in the same pass.

## Proper Implementation + Documentation Workflow (No Shortcuts)
- If feature A depends on feature B, implement/verify B first or gate A behind a flag.
- Enforce correctness server-side (RLS/edge/DB constraints); client gating is UX only.
- Design for concurrency and retries: idempotency keys, OCC/versioning, safe replay.
- Observability from day 1: correlation IDs, typed errors, structured logs (no secrets/PII).
- Dev-only code must be **unreachable** in production (flag/env-gated, default off, documented removal).
- Add concise comments for non-obvious logic (intent, invariants, failure modes).
- End-to-end validation is mandatory for every change:
  - Include offline/online, retries, dependent services, and full user journeys.
  - For debugging/fixes: read `docs/issue-log.md`, identify last known good commit, validate the full flow.
- Documentation is part of Done:
  - Update runbooks/contracts.
  - Append `docs/issue-log.md` with timestamped entries; never edit or reorder history.

## Always Ask: What Can Break at Scale?
- N+1 queries, missing indexes, cache invalidation drift, retry storms, race conditions,
  inconsistent policy enforcement, and degraded offline sync are common failure modes.
- Call these out early, design mitigations, and verify them with tests + observability.
