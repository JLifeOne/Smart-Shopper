# Docs Index (Start Here)

This folder is the source of truth for product requirements, architecture, runbooks, and rollout plans.

## Fast Start (new session)
1. `AGENTS.md`
2. `docs/proper-implementation.md`
3. `docs/runbooks/proper-implementation-workflow.md`
4. `docs/runbooks/senior-engineer-operating-prompt.md`
5. `docs/setup.md`
6. `scripts/README.md`

Optional helper:
- `node scripts/session_start.mjs`

## Whole-product North Star & current reality
- `docs/PRODUCT-NORTH-STAR.md` — Highest-level Smart Shopper product charter. Protects the product's direction: shopping execution → shopping intelligence → recommendation intelligence → commercial marketplace → operational platform. Promos must strengthen shopper utility rather than replace it.
- `docs/SMART-SHOPPER-CURRENT-STATE.md` — Dated implementation reality map showing what the current codebase implements, partially implements, anticipates, or is still missing. Refresh this after substantial changes land on `main`.

## Product & Requirements
- `docs/prd.md` — Unified PRD (requirements + acceptance criteria).
- `docs/roadmap.md` — High-level phase roadmap.
- `docs/planning/implementation-roadmap.md` — UX upgrade slices / feature flags.

## Promos Marketplace
Start with these for any substantive Promos work:
- `docs/features/promos-marketplace/NORTH-STARS.md` — Map of the three interconnected Promos component North Stars and their shared contracts.
- `docs/features/promos-marketplace/SHOPPER-EXPERIENCE-NORTH-STAR.md` — Shopper-facing Home Spotlight, Promos feed/detail, interests, relevance, Like/Save/Share, views, privacy, saved promos, and UI/UX rules.
- `docs/features/promos-marketplace/ADVERTISER-NORTH-STAR.md` — Advertiser campaign creation, Creative Studio, payment/submission, entitlements, reuse, analytics, optimization, and lifecycle experience.
- `docs/features/promos-marketplace/COMMAND-CENTER-NORTH-STAR.md` — Desktop internal control plane for advertiser operations, ad inventory/commercial pricing, analytics, Experience Manager, support, payments, moderation, roles, system controls, and audit.
- `docs/features/promos-marketplace/OFFER-REDEMPTION-CONTRACT.md` — Shared Save → Claim → Redeem → Verified Purchase contract, coupon strategies, QR Promo Pass, physical redemption, external click/ticket attribution, conversion verification, fraud/privacy rules, and V1 scope.
- `docs/features/promos-marketplace/README.md` — Umbrella Product + Engineering North Star containing earlier full-system detail not yet migrated into component documents.
- `docs/features/promos-marketplace/DESIGN-SPEC.md` — Promos design specification and interaction direction.
- `docs/features/promos-marketplace/DECISIONS.md` — Append-only product and engineering decision history. Read the latest entries before changing the feature.
- `docs/features/promos-marketplace/FAILURE-LOG.md` — Append-only chronological failure/fix history. Never delete resolved incidents.

## Architecture & Offline
- `docs/architecture.md` — System overview.
- `docs/offline-storage.md` — Offline-first plan (WatermelonDB + sync strategy).
- `docs/known-issues.md` — Known dev warnings and mitigations.

## Runbooks (operational truth)
Start here when working in a subsystem:
- `docs/runbooks/expo-metro-windows.md` — Expo/Metro on Windows + PNPM.
- `docs/runbooks/new-machine-bootstrap.md` — End-to-end machine migration/bootstrap + session prompt.
- `docs/runbooks/typecheck-and-safe-fetch.md` — Typecheck pitfalls + fetch typing guardrails.
- `docs/runbooks/list-items-category-backfill.md` — Backfill classifier metadata on list items.
- `docs/runbooks/menu-feature-workflow.md` — Menu/Recipes production-tier workflow.
- `docs/runbooks/menus-observability-and-alerts.md` — Dashboards, alerts, and incident response for Menus.
- `docs/runbooks/notifications-promo-alerts.md` — Promo alerts pipeline (in-app + push) runbook.
- `docs/runbooks/supabase-test-db-troubleshooting.md` — Fixing `supabase test db` (pgTAP) failures across environments.
- `docs/runbooks/brand-insights-migration.md` — Brand insights migration + rollback.
- `docs/runbooks/brand-insights-job.md` — Nightly brand job operations.

## Menus / Recipes planning
- `docs/planning/menus-api-contracts.md` — Contract for sessions/recipes/convert/pairings/reviews.
- `docs/planning/menus-production-plan.md` — Rollout plan for Menus stages.

## Design
- `docs/design-spec.md` — Mobile design spec (tokens/components/motion).
- `docs/design/alignment.md` — Visual direction and accessibility notes.
- `docs/design/universal-photo-ingestion.md` — Capture + classifier + paywall enforcement spec.

## Brand-aware pricing intelligence
- `docs/design/brand-aware-pricing-phases-0-2.md` — Spec (phases 0–2).
- `docs/planning/brand-insights-backlog.md` — Backlog + alignment checklist.

## Data dictionaries (catalog/classifier inputs)
- `docs/data/food-dictionary-western-part1.md`
- `docs/data/food-dictionary-western-part2.md`
- `docs/data/food-dictionary-western-part3.md`
- `docs/data/food-dictionary-western-part4.md`

## CI references
- `docs/ci/supabase-verify.md` — What the Supabase CI workflow checks and how to configure secrets.
