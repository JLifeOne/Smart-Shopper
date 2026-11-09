# Smart-Shopper — Feature Architecture and Takeover Register

**Policy adopted 2026-11-09. SOURCE-AUDIT-PENDING — existing features have NOT yet been individually audited.** This file is the required durable architecture record; never guess what is implemented from screenshots or project names.

## Feature inventory (complete against actual code, incrementally)
| ID and purpose | Independent owner / source | Upstream dependencies | Downstream consumers and cross-feature effects | Data/API/state/security contracts | Tested / unverified / risk |
|---|---|---|---|---|---|
| SOURCE-AUDIT-PENDING | Requires source inspection | Requires source inspection | Requires source inspection | Requires source inspection | UNVERIFIED |

## Mandatory card for each existing or new feature
- **ID, purpose and users:** user story, acceptance, status and evidence.
- **Independence:** one authoritative owner/module and what it does *not* own; standalone vs tightly/loosely coupled.
- **Upstream:** exact source imports, API/RPC/function signatures, database tables, Auth/RLS, environment/third-party services.
- **Downstream/interconnectivity:** callers, consumers, routes, notifications, state changes, event and queue effects, cross-role/cross-feature effects.
- **Data contracts:** inputs/outputs, units, invariants, state transitions, idempotency, offline/retry and failure paths.
- **Safety and migration:** permissions, personal data boundaries, feature flags, compatibility, rollback.
- **Evidence:** exact test/commit, real environment and role/device verification, known bugs and unverified assumptions.
- **Continuation:** safe extension points, dependency graph, next maintainer steps and related source comments.

Update a real source-backed dependency graph (feature → requires → consumed by); mark missing facts **UNVERIFIED**. PRs must update this register, code interface comments, affected dependents, tests, and the append-only SU/issue log. No claim that the code is well commented or takeover-ready until audited.
