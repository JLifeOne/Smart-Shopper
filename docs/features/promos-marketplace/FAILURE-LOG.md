# Promos Marketplace Failure Log

This file is append-only and chronological.

## Rules

- Never delete a historical failure because it has been fixed.
- Never rewrite an old failure entry to hide that it occurred.
- If new evidence changes the root cause, append a correction entry and reference the original entry.
- If the same symptom returns, link the new incident to the previous one and explain why the previous prevention did not stop it.
- Every meaningful failure should leave behind a test, guardrail, runbook note, validation rule, alert, or documented reason why no automated guardrail is practical.

## Required incident format

### YYYY-MM-DD HH:MM - Short incident title

- Environment: local / branch preview / staging / production
- Branch / commit:
- Feature area:
- Severity:
- User-visible symptom:
- Reproduction steps:
- Expected behavior:
- Actual behavior:
- Root cause:
- Contributing factors:
- Fix:
- Files / migrations changed:
- Verification performed:
- Regression test added:
- Observability / alert added:
- Rollback / recovery notes:
- Related prior incidents:
- Follow-up work:
- Status: open / mitigated / resolved / monitoring

## 2026-10-13 - Log initialized

- Environment: documentation phase
- Branch / commit: `feature/promos-marketplace`
- Feature area: Promos Marketplace
- Severity: informational
- User-visible symptom: none
- Reproduction steps: not applicable
- Expected behavior: maintain a durable chronological engineering history from the start of feature development
- Actual behavior: log created before implementation begins
- Root cause: not applicable
- Contributing factors: not applicable
- Fix: not applicable
- Files / migrations changed: `docs/features/promos-marketplace/FAILURE-LOG.md`
- Verification performed: file created on the feature branch only
- Regression test added: not applicable
- Observability / alert added: not applicable
- Rollback / recovery notes: documentation-only commit
- Related prior incidents: none
- Follow-up work: append the first real implementation failure when encountered
- Status: resolved

## 2026-10-13 10:35 - Promo Detail modal delegated-click handling would swallow inner actions

- Environment: branch prototype review before Cloudflare preview deployment
- Branch / commit: `feature/promos-marketplace`; fixed by commit `eda34f14c30cbcf19f6be876af4f178f788d6ffd`
- Feature area: PWA shopper Promo Detail / promotion-options modal interaction
- Severity: medium, pre-release
- User-visible symptom: in the initial prototype implementation, clicks inside the modal could fail to reach the document-level delegated action handler. The close control, Like, Save, CTA, and other modal actions were therefore at risk of appearing clickable while doing nothing.
- Reproduction steps: open a Promo Detail or promotion-options modal in the initial implementation; click an action rendered inside the modal; the modal-root listener stops propagation before the document-level delegated handler receives the event.
- Expected behavior: backdrop click closes the dialog, while controls inside the dialog execute their own actions and do not accidentally dismiss the dialog.
- Actual behavior: the first event strategy indiscriminately stopped propagation for clicks originating within modal content, which also prevented the central delegated handler from seeing legitimate control actions.
- Root cause: conflicting event-delegation responsibilities between a modal-root propagation blocker and the document-level action router.
- Contributing factors: the prototype uses dynamically rendered HTML and one delegated click router; a generic `stopPropagation()` rule looked like a simple way to protect backdrop dismissal but also blocked intended actions.
- Fix: removed the generic modal-content propagation blocker; backdrop dismissal now occurs only when the exact clicked target matches `[data-backdrop]`; close and modal actions remain routed through the single document-level handler. Modal Like/Save actions intentionally rerender and reopen the current detail view to keep state and visual feedback synchronized.
- Files / migrations changed: `prototype/promos-marketplace/app.js`
- Verification performed: reviewed all modal event paths after the rewrite: exact backdrop click, explicit close button, Like, Save, Share, CTA, `Why am I seeing this?`, Not interested, Hide, and Report. Public branch-preview verification remains part of the deployment smoke test.
- Regression test added: manual preview checklist requirement established for modal controls; production integration must add automated browser/E2E coverage for backdrop versus inner-action clicks.
- Observability / alert added: none for the static prototype; production interaction failures will require client error telemetry where appropriate.
- Rollback / recovery notes: the prototype is isolated on `feature/promos-marketplace`; `main` was never changed. The corrected implementation supersedes only the branch prototype code.
- Related prior incidents: none.
- Follow-up work: verify the corrected interaction in the Cloudflare Pages preview; add automated E2E interaction tests before production integration.
- Status: resolved / monitoring in branch preview
