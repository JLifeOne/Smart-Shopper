# Smart-Shopper — integrated PR development and isolated staging standard

**Owner-wide mandatory engineering policy — 2026-11-09.**
This document is authoritative for this repository, alongside `AGENTS.md` and any stricter application-specific security, architecture, UX, release or testing rules. It describes the required workflow; **it does not claim staging is already configured**.

## Invariants
1. **Preserve the working app.** Read `AGENTS.md`, this document, existing official documentation, project handoff, accepted UI references, open PRs, migrations and recent regressions before changing code. Audit the feature's routes, components, data ownership, dependencies and connected pages. Enhance the existing application rather than rebuilding it or mixing distinct apps.
2. **Feature branch + PR first.** Start each change from current verified `main` (or an explicitly reviewed stacked dependency). Never directly implement on production `main`, force-push working history, secretly edit deployed code, or merge experimental code into production. Maintain one scoped PR with clear dependencies and rollback notes.
3. **Stay synchronized without contamination.** Regularly integrate the latest `main` into the PR branch, resolve conflicts there, and re-run all affected checks. This is **main → PR**, not PR → main. Protect existing public APIs, navigation, visual system, roles and domain contracts. Stacked PRs must show their parent/base relationship.
4. **Preview the complete connected product.** The PR preview must boot the real current app plus the change, with its actual customer/business/admin or other applicable roles, routes, auth, server APIs, database schema and shared components. Standalone mocks/screenshots may supplement but **never replace authenticated end-to-end testing**. Pin and verify preview deployment against the PR commit SHA.
5. **Hard-isolate preview writes and side effects.** Run PR previews against a dedicated staging environment: its own database, Auth users, storage, Realtime, functions, queue/jobs, session namespaces, test merchant/SMS/email/webhook settings, and environment variables as applicable. Never point a writable preview at a production database/API, reuse production service-role keys, or copy real customer records into testing. Public client keys are not secrets but do not make cross-environment writes safe. Default staging outbound effects to disabled/sandbox.
6. **Fail closed when staging is missing.** A PR preview may be read-only against safe publicly accessible data, but disable all mutating actions and unsafe background jobs until staging exists. Mark the PR **BLOCKED: isolated staging not verified**. Do not quietly use production for convenience or say isolation is complete because URLs differ.
7. **Feature flags and server-side boundaries.** Keep unfinished features disabled outside staging. Validate authentication, authorization, tenant isolation, RLS, entitlements, state transitions and audit on the server; never rely solely on hidden buttons. Stage schema migrations on staging first with reviewable forward/backfill/rollback plans and no destructive fallback.
8. **Prove integration and responsiveness.** At minimum run relevant lint/typecheck/unit/integration/contracts/security and build checks, followed by actual deployed flows across signed-out/signed-in accounts, multiple roles where relevant, realistic data, browser widths 360/390/430 px and desktop, navigation, accessibility, empty/loading/error states, offline/reconnect and performance when applicable. Compare with the approved baseline. Recheck after rebases or merging `main` into the feature branch.
9. **Evidence over assertions.** Report separately **implemented**, **CI-tested**, **database-tested**, **preview-rendered**, **authenticated E2E-tested**, and **unverified/blocked**. A green CI run is not proof that production workflows, maps, payments or third-party integrations work. Never invent passing tests, prices, screenshots or deployment URLs.
10. **Owner-controlled promotion.** Merge into `main` only after owner review/approval, checks pass, release/staging migrations are validated, regression risks are addressed and rollback is documented. Deploy through the existing production pipeline and verify again after release; keep ability to revert.
11. **Durable chronological records.** Maintain the existing project-state/handoff, decisions, test evidence, open risks and **append-only SU/issue/fix log** (create `docs/SU_LOG.md` only if none exists). Never delete/rewrite prior log entries; append dated evidence and outcomes. Every PR includes exact branch/preview SHA, dependencies, test matrix, migration impact, outstanding failures and next steps.

## Required PR acceptance checklist
- [ ] Current working `main` baseline and all relevant original workflows inspected
- [ ] Separate PR with scoped diff, merge dependencies and explicit preview commit SHA
- [ ] Isolated staging Auth/database/storage/API/side effects confirmed; no production write access from preview
- [ ] Existing application navigation, roles, UX and shared components remain connected
- [ ] Migrations, RLS, permissions and cross-user security tested when relevant
- [ ] Unit/contracts/build plus deployed responsive and authenticated end-to-end testing performed
- [ ] Screenshots or recordings compared to approved phone and desktop baseline
- [ ] SU log, project handoff and verification/limitations updated append-only
- [ ] Owner approves merge; production deployment and rollback plan validated

## Repository-specific implementation note
Retain every existing AGENTS.md security and implementation runbook requirement. No test bypass for authorization, service-role credentials or RLS. Audit repo-specific workflows before any staging configuration.

**Mandatory stop condition:** If staging isolation or a critical integration contract cannot be verified, preserve production and leave the feature PR open. No production merge is implied by this policy update.
