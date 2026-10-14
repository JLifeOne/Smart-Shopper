# Smart Shopper — Current-State Reality Map

## Status

- Audit date: 2026-10-13
- Repository: `JLifeOne/Smart-Shopper`
- Baseline inspected: current `main` plus Promos documentation on `feature/promos-marketplace`
- Purpose: record what the codebase currently implements, partially implements, anticipates, or is missing so future work does not accidentally change product direction based on incomplete memory.
- This document is a dated implementation snapshot, not the permanent product charter. Use `docs/PRODUCT-NORTH-STAR.md` for durable direction.

## 1. Broad conclusion

Smart Shopper is already broader than a basic shopping-list app.

The repository contains foundations or implementations for:
- lists and list items;
- text/voice/photo capture flows;
- categorization and category telemetry;
- stores/catalog concepts;
- price points and brand-aware price intelligence;
- receipts/receipt normalization infrastructure;
- collaboration;
- recommendations;
- notifications;
- menu/recipe intelligence;
- account/profile settings;
- runtime configuration;
- Supabase migrations, RLS, Edge Functions, tests, and operational documentation.

Promos should extend this shopping-intelligence platform rather than redefine Smart Shopper as an advertising product.

## 2. Current shopper navigation and Home

Current Home/nav code already anticipates:
- Home;
- Insights;
- Promos;
- Lists;
- Receipts.

Home currently contains or references:
- greeting/user identity;
- at-a-glance metrics;
- spend heatmap;
- Promo Spotlight placeholder;
- Menus entry point;
- Budget Insights placeholder;
- Suggested additions/recommendations;
- create-list workflow and capture mechanisms.

Important implication:

Promos already has a natural navigation and Home placement. It should be implemented as the planned feature, not bolted into unrelated screens.

## 3. Areas that are implemented or materially established

### 3.1 Lists / list capture

Substantial list infrastructure exists, including list screens, item mutations, parsing/enrichment, category handling, capture helpers, and related UI.

### 3.2 Brand and price intelligence

The backend includes brand resolution/insights and price-tier logic with product/store/brand/effective-unit-price concepts.

This is consumer shopping-price intelligence and must remain semantically separate from advertising rate cards.

Use `Ad Inventory & Commercial Pricing` or similarly explicit terminology for advertising pricing rather than generic `Pricing` where confusion is possible.

### 3.3 Collaboration

The codebase includes collaboration schema/policies and Edge Function infrastructure.

Shared household shopping remains part of Smart Shopper's intended product identity.

### 3.4 Menu / recipe intelligence

Menus are not merely a placeholder. There is significant backend and mobile work for:
- menu sessions;
- recipe creation;
- title-only fallback;
- usage limits;
- premium gating;
- pairings;
- packaging;
- reviews;
- regeneration;
- policy;
- related idempotency/security work.

This reinforces that Smart Shopper is becoming a broader food/shopping intelligence product.

### 3.5 Notifications

The notification foundation is substantial and should be reused for Promo engagement rather than recreated.

Current concepts include:
- notification campaigns;
- per-user inbox;
- promo/system/info types;
- user notification preferences;
- promo opt-in;
- push opt-in;
- quiet hours;
- maximum promos per day;
- device registration;
- delivery records;
- retries/observability fields;
- dispatch/send/list/read/preferences/register functions.

Future Promo notifications, saved-offer expiry reminders, and advertiser/customer-engagement workflows should extend these foundations where technically sound.

### 3.6 Runtime configuration

A server-driven runtime-config concept already exists.

Current usage is limited, but the pattern is strategically relevant to the future Command Center Experience Manager and feature controls.

Do not build a second unrelated configuration mechanism without evaluating whether the existing runtime-config foundation should be extended.

### 3.7 Account/profile

The current profile surface includes locale, currency, tax preferences, optional demographic/location fields, and Promo/push notification preferences.

Important privacy implication:

The existence of a profile field does not automatically make it eligible for advertising targeting.

Promo/recommendation targeting requires its own documented privacy/eligibility boundary.

## 4. Areas that are partial or placeholder

### 4.1 Promos

Current shopper code has:
- a Home `Promos spotlight` placeholder;
- a Promos nav tab;
- a `PromosScreen()` placeholder;
- promo-notification infrastructure.

It does not yet have the production campaign marketplace, feed, offer system, analytics pipeline, advertiser dashboard, or Command Center.

### 4.2 Insights

The current nav-level Insights surface is still a placeholder, although Home already contains some analytics/heatmap work.

### 4.3 Receipts shopper surface

Receipt concepts/backend normalization exist, but the current nav-level Receipts surface remains incomplete/placeholder relative to the larger PRD intent.

### 4.4 Budget intelligence

Home references Budget Insights, but the broader budget experience is not yet a mature implemented product surface.

### 4.5 Recommendations

The mobile recommendation hook supports:
- query;
- locale;
- contextual items;
- product/brand/category suggestions;
- confidence;
- model version metadata.

However, it depends on configured recommendation-service infrastructure and should not be assumed to be a complete production recommender.

For Promos, deterministic ranking should remain the V1 baseline until measurement/data quality justify learned ranking.

## 5. Major missing foundations relevant to Promos

### 5.1 Real analytics ingestion/persistence

The current mobile `trackEvent()` implementation only places events in an in-memory queue and logs them in development. The current `flushAnalytics()` removes queued events rather than persisting a real analytics stream.

Therefore advertiser-facing analytics cannot be considered production-real until Smart Shopper has a durable event pipeline.

Required direction:
- versioned event contract;
- ingestion endpoint/pipeline;
- event validation;
- privacy classification;
- durable storage/streaming;
- aggregate/materialized advertiser metrics;
- marketplace/platform analytics;
- dedupe/idempotency where required;
- observability;
- retention policy.

Promo analytics must be built on trustworthy event semantics, not UI mock numbers.

### 5.2 General Smart Shopper entitlement/subscription model

The repository has menu-specific premium/usage enforcement and useful server-side patterns, but this is not yet a general Smart Shopper entitlement platform.

Do not use `is_menu_premium` as the global source of truth for Promo advertising benefits.

Promos needs a general entitlement/ledger model capable of representing independent benefits such as Promo Days, placement eligibility, credits, expiration, reservations, consumption, restoration, and paid top-ups.

Reuse the engineering patterns from menu entitlements where sound:
- server authority;
- concurrency protection;
- idempotency;
- RLS/authorization;
- atomic usage enforcement.

### 5.3 Advertiser/campaign marketplace schema

There is not yet a production Promos schema covering the full marketplace.

Needed concepts include:
- advertiser profiles;
- campaigns/submissions;
- creative versions;
- placements;
- ad inventory/capacity;
- reservations;
- commercial agreement;
- delivery plan;
- entitlements/adjustments;
- payments/refunds;
- moderation/audit;
- shopper promo engagement;
- offers/claims/redemptions/conversions.

### 5.4 Real payment gateway

The production payment provider and webhook/capture/refund implementation remain undecided/not implemented for Promos.

### 5.5 Admin / Command Center application

No dedicated `admin.smartshopper.com` application exists yet.

Recommended future monorepo direction is a dedicated app such as `apps/admin`, reusing shared packages/contracts where appropriate while maintaining separate internal authentication and authorization boundaries.

### 5.6 Offer/redemption system

Smart Shopper does not yet have the production saved-offer / coupon / QR redemption / verified conversion system.

Use `docs/features/promos-marketplace/OFFER-REDEMPTION-CONTRACT.md` as the current product contract.

## 6. Existing engineering patterns worth preserving

The repo contains several important implementation patterns that should influence new work.

### 6.1 Proper Implementation Protocol

The project explicitly requires:
- correctness over speed;
- repo-wide search before duplication;
- idempotency;
- concurrency safety;
- observability;
- RLS/authZ;
- retries/timeouts;
- feature flags;
- rollback;
- testing;
- documentation;
- end-to-end verification.

These remain non-negotiable for Promos.

### 6.2 Append-only issue history

The current issue log records previous regressions and why they occurred.

Future work should continue to inspect historical failures before patching related areas.

### 6.3 Server-side premium/usage enforcement

Menu flows demonstrate useful patterns such as:
- server-driven entitlement checks;
- idempotency keys;
- advisory/transactional locks;
- atomic usage counters;
- RLS restrictions.

Promos should copy the principles, not couple itself to menu-specific tables/flags.

### 6.4 Notifications worker patterns

Notification delivery already uses server/service-owned delivery state, retries, device registration, and worker claiming.

Reuse rather than rebuild where applicable.

## 7. Areas where unnecessary direction change should be avoided

Do not:
- rewrite the app around Promos;
- turn Home into an ad wall;
- replace consumer product-price intelligence with advertising pricing semantics;
- perform a giant Home refactor merely to add Promo components;
- create a second notification stack;
- create an unrelated runtime-config system without evaluating the existing one;
- treat menu-specific premium flags as global subscription architecture;
- call mock analytics production analytics;
- expose profile/demographic fields to targeting merely because they exist;
- merge major feature work directly into `main` before branch preview/verification.

## 8. Recommended modular build direction

Promos should be introduced through feature-owned boundaries rather than continuously enlarging already-large files such as Home.

Example conceptual structure:
- `src/features/promos/...`
- shared Promo contracts/types;
- isolated shopper components;
- separate advertiser web surfaces;
- separate admin web application;
- shared backend contracts/services where appropriate.

Integrate through small interfaces rather than embedding entire subsystems into Home or other monolithic screens.

## 9. Current documentation hierarchy

For whole-product direction:
1. `docs/PRODUCT-NORTH-STAR.md`
2. `docs/prd.md`
3. relevant architecture/planning documents

For Promos:
1. `docs/PRODUCT-NORTH-STAR.md`
2. `docs/features/promos-marketplace/NORTH-STARS.md`
3. relevant component North Star
4. `docs/features/promos-marketplace/OFFER-REDEMPTION-CONTRACT.md` where offers/conversion are involved
5. latest append-only decisions
6. umbrella feature README/design specs

For implementation reality:
- this file;
- code on the target branch;
- issue/failure logs;
- tests and migrations.

## 10. Audit summary

The strongest current direction is:

> Preserve Smart Shopper as a shopping-intelligence product. Complete and strengthen its core utility over time, and build Promos as a measurable first-party commercial layer that uses Smart Shopper's existing shopping context without compromising organic price truth or shopper privacy.

This snapshot should be refreshed when substantial areas land on `main` so future sessions do not depend on stale memory.