# Brand-Aware Pricing Intelligence — Alignment & Backlog

## Stakeholder Alignment Checklist

- **Product (J. Law)**  
  - Confirm rollout strategy (internal staging → controlled cohort) and kill-switch expectations.  
  - Success metrics: brand match rate ≥ 90%, delta accuracy ±5%.  
  - Approve phased rollout sequencing vs MVP roadmap.

- **Design (UI Lead)**  
  - Validate entry points for brand insights (store compare sheet, library cards, list detail).  
  - Review data state handling (sparse data, low confidence, conflicts) ahead of Phase 3 UI work.  
  - Schedule design review once Phase 1 APIs are available in staging.

- **Mobile Engineering Lead**  
  - Sign off on WatermelonDB schema v6 migration, sync payload changes, telemetry instrumentation.  
  - Ensure app gracefully degrades via remote kill switch when backend disabled.

- **Backend/Data Lead**  
  - Own Supabase migrations, receipt processing function, nightly aggregation job, and observability setup.  
  - Provide incident playbook and testing harness guidance.

- **Analytics Partner**  
  - Define dashboards (match rate, insight freshness, pipeline latency).  
  - Outline experiment/validation plan for staged rollout.

- **Ops/Release**  
  - Review alerting thresholds, canary checklist, rollback plan (remote kill switch + migration strategy).  
  - Ensure runbooks updated and on-call notified before staging rollout.

## Implementation Backlog (Initial Draft)

| ID | Title | Phase | Summary | Owners | Dependencies |
| --- | --- | --- | --- | --- | --- |
| BRAND-001 | Alignment & Design Doc | 0 | Finalise design doc (this set) and capture stakeholder sign-off notes. | Product + Mobile | none |
| BRAND-002 | Supabase Schema Migration | 0 | Add `brands`, `brand_aliases`, update `products`, `price_points`; migration tests + runbook. | Backend/Data | BRAND-001 |
| BRAND-003 | Watermelon Schema Upgrade | 0 | Add brand fields, migrations, backfill logic, unit tests. | Mobile | BRAND-001 |
| BRAND-004 | Telemetry & Kill Switch Scaffolding | 0 | Implement brand telemetry hooks and remote kill-switch wiring. | Mobile + Backend | BRAND-002, BRAND-003 |
| BRAND-005 | Receipt Parser Brand Resolution | 1 | Build Edge function logic, alias matching, error taxonomy, Supabase tests. | Backend/Data | BRAND-002 |
| BRAND-006 | Sync Queue Enhancements | 1 | Include brand metadata in sync events, implement retry/backoff + telemetry. | Mobile | BRAND-003, BRAND-005 |
| BRAND-007 | Nightly Aggregation Job | 2 | Scheduled job computing brand averages/deltas, idempotent writes, logs. | Backend/Data | BRAND-002, BRAND-005 |
| BRAND-008 | Insight Storage & RPC | 2 | Create `brand_price_insights` table/view + RPC endpoint, load tests. | Backend/Data | BRAND-007 |
| BRAND-009 | Observability & Dashboards | 2 | Configure metrics, alerts, dashboards covering ingestion + aggregation. | Analytics + Ops | BRAND-005, BRAND-007, BRAND-008 |
| BRAND-010 | QA/Test Harness Setup | 0–2 | Supabase fixtures, Vitest suites, smoke tests for nightly job. | Mobile + Backend QA | BRAND-002, BRAND-003, BRAND-005 |

### Backlog Notes
- Tickets will be broken down further during sprint planning (granular tasks per codebase).
- Each ticket must attach test plans and observability updates before merge.
- Runbook updates (Ops) should accompany BRAND-007/BRAND-009 completion.

## Next Actions

1. Share design doc (`docs/design/brand-aware-pricing-phases-0-2.md`) and this backlog with stakeholders for review.  
2. Collect approvals/feedback, capture in project tracker (JIRA/Linear).  
3. Sequence tickets into upcoming sprints; ensure capacity allocation across mobile/backend/data/analytics teams.  
4. Prepare staging environment with kill switch defaulted to “off”, ready for Phase 0 migrations.
