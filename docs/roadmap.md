# Smart Shopper Implementation Roadmap

## Phase A — MVP Core (Weeks 0-10)
### Objectives
- Ship foundation for list capture, receipt ingestion, unit price comparisons, and calendar heatmap.
- Establish secure authentication, offline data cache, and analytics baseline.

### Workstreams
1. **Project Setup (Week 0-1)**
   - Initialize PNPM workspace: `apps/mobile`, `packages/shared`, `supabase`.  
   - Configure ESLint, Prettier, Husky pre-commit, commitlint, TypeScript strict mode.  
   - Set up Sentry, Segment, environment variable management (Expo + Supabase).  
   - Draft security baseline checklist (secret rotation, RLS policies, SOPS for secrets).
2. **Auth & User Settings (Week 1-2)**
   - Implement Supabase Auth flows; enable email magic link + OAuth providers.  
   - Create profile screen, locale/currency preferences, secure storage of sessions.  
   - Add biometric unlock toggle.
3. **List Capture & Parsing (Week 2-4)**
   - Build text/checkbox list UI with optimistic updates.  
   - Integrate voice dictation flow; queue transcripts offline.  
   - Implement photo capture → on-device OCR → review screen.  
   - Create catalog matching service; capture corrections for model training.
4. **Receipt Ingestion (Week 3-6)**
   - Camera flow with cropping, perspective fix, and multi-page capture.  
   - Edge function for receipt parsing and product alias matching.  
   - Validation UI to approve/edit parsed line items.  
   - Sync pipeline updating `PricePoint` records with unit normalization.
5. **Price Comparison & Trends (Week 5-8)**
   - Cheapest-store view with color-coded chips and trend indicators.  
   - Item detail screen with sparkline chart and receipt gallery.  
   - Trend calculation job (Edge function + scheduled invocation).  
   - Handle stale data/outliers with rule-based exclusions.
6. **Calendar Heatmap (Week 7-9)**
   - Build heatmap view with spend layer; add toggles for savings/volatility.  
   - Day detail sheet summarizing trips, biggest movers, savings vs baseline.  
   - Performance tuning (virtualized list, memoized selectors).
7. **Hardening & Launch Prep (Week 9-10)**
   - Pen test checklist, dependency audit (Dependabot + pnpm audit).  
   - App Store / Play Store metadata, privacy policy, Terms of Service.  
   - Beta testing via TestFlight/EAS + Firebase App Distribution.  
   - Production database migration runbook.

## Phase B — MVP Plus (Weeks 10-16)
- Add budget/trip estimator, list sharing with real-time sync, offline-first polish (conflict resolution strategies), and improved onboarding.  
- Security focus: review RLS policies for shared lists, add rate limiting to sharing endpoints.

## Phase C — Growth (Weeks 16+)
- Price alerts, crowdsourced price submissions with trust scoring, pantry inventory predictions, deals & coupons, geofenced store switcher.  
- Introduce moderation tools, anomaly detection, and partitioned data storage for scale.

## Cross-Cutting Security & Compliance
- **Secrets**: Manage via SOPS + age; no raw secrets in repo.  
- **RLS Tests**: Automated tests verifying access policies per table.  
- **Data Residency**: Support region-specific Supabase projects if required.  
- **PII Minimization**: Avoid storing names on receipts; hash user identifiers for analytics.  
- **Incident Response**: Document escalation playbook and monitoring alerts.  
- **Backups**: Nightly db/backups with integrity checks; quarterly restore drill.

## Quality Gates
- Unit tests (Vitest) ≥70% coverage on shared libs; critical modules >80%.  
- E2E tests (Detox) covering list capture, receipt scan, price comparison, and heatmap flows.  
- Edge function contract tests + load testing for receipt parsing throughput.  
- Performance budget: cold start <4s, time-to-interactive <2s on mid-tier Android.

## Release Cadence
- Fortnightly milestones with release notes.  
- Feature flags for beta toggles.  
- Retrospective + metrics review at end of each phase.

---
This roadmap is intentionally aggressive; adjust timelines based on team capacity, procurement (OCR licenses), and compliance reviews.
