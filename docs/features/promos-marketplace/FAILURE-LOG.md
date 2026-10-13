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
