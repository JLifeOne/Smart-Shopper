# Smart Shopper Promos Marketplace — North Star Map

## Status

- Feature: Promos Marketplace
- Repository: `JLifeOne/Smart-Shopper`
- Development branch: `feature/promos-marketplace`
- Production merge policy: no implementation from this feature is merged to `main` until branch preview, testing, design review, and explicit merge approval are complete.
- Document type: living source-of-truth map.
- History policy: this file and the three North Stars may be revised as the product develops. Historical product/engineering decisions belong in `DECISIONS.md`; failures and fixes belong in `FAILURE-LOG.md` and are append-only.

## Why there are three North Stars

Promos Marketplace is not one screen and should not be documented as one undifferentiated feature.

It contains three large, interconnected products:

1. the shopper-facing Promos experience inside Smart Shopper;
2. the advertiser-facing campaign, creative, payment, optimization, and analytics experience;
3. the Smart Shopper internal Command Center used to operate the marketplace and control supported app experiences.

Each has different users, security boundaries, workflows, interfaces, success metrics, and engineering risks. They share the same marketplace data and commercial truth, but they must be understandable and buildable independently.

## The three North Stars

### 1. Shopper Experience North Star

File: `SHOPPER-EXPERIENCE-NORTH-STAR.md`

Owns:
- Home Promo Spotlight;
- Promos tab/feed;
- Promo detail;
- categories and explicit interests;
- Like, Save, Share, Hide, Not Interested, Report;
- claim/redeem concepts;
- `Why am I seeing this?`;
- privacy-preserving relevance and personalization;
- recommendation/ranking behavior visible to shoppers;
- ad labeling and organic-versus-paid separation;
- saved promos and reminders;
- shopper UI/UX, accessibility, motion, responsive/mobile behavior;
- shopper-side analytics event definitions needed by the other two systems.

Primary question:

> How should a shopper experience promotions so that they are useful, trustworthy, controllable, visually strong, and relevant without Smart Shopper becoming an intrusive ad network?

### 2. Advertiser Experience North Star

File: `ADVERTISER-NORTH-STAR.md`

Owns:
- advertiser onboarding/profile;
- advertiser types and verification;
- campaign creation;
- campaign reuse;
- optional creative upload;
- Creative Studio and Brand Profile;
- placement, duration, time-slot, geographic and category selection;
- pay-as-you-go advertising;
- Premium Promo Days/credits/entitlements;
- payment-at-submission flow;
- paid/under-review lifecycle;
- advertiser dashboard;
- campaign analytics;
- views, viewable impressions, unique reach, opens, likes, saves, shares, CTA actions, claims and redemptions;
- optimization recommendations;
- A/B creative testing;
- campaign renewal/extension;
- advertiser-facing support and account state;
- privacy boundaries around analytics.

Primary question:

> How does an advertiser create professional campaigns with low friction, understand real performance, improve outcomes, trust Smart Shopper's delivery, and return to advertise again?

### 3. Command Center North Star

File: `COMMAND-CENTER-NORTH-STAR.md`

Owns:
- separate desktop-first internal product, intended for a dedicated domain such as `admin.smartshopper.com`;
- internal admin authentication and role-based access;
- command overview;
- advertiser 360/account operations;
- campaign operations and moderation;
- creative operations and AI-assisted Creative Studio controls;
- inventory and pricing;
- paid entitlement integrity and internal bonus/adjustment controls;
- marketplace analytics;
- individual advertiser analytics access;
- Smart Shopper internal/platform analytics;
- Experience Manager for supported consumer-app surfaces;
- engagement/communications;
- payments, credits and refunds;
- customer support tooling;
- trust/safety;
- system controls and kill switches;
- feature flags and release controls;
- audit history;
- settings/configuration domains;
- operational opportunities/recommendations.

Primary question:

> How does Smart Shopper operate the entire marketplace safely and commercially from a powerful desktop control plane without requiring a code deployment for every supported content, inventory, campaign, pricing, or experience change?

## Shared system boundaries

The North Stars are separate documents, but they must never become separate truths.

The following concepts are shared and must remain consistent across all three:

### Campaign identity

A single campaign object flows through advertiser creation, payment, moderation, scheduling, delivery, shopper surfaces, analytics, and Command Center operations.

Admin must not recreate an advertiser's approved campaign manually as a second campaign.

### Payment and commercial truth

The system must preserve exactly what was purchased.

Purchased entitlement, complimentary adjustments, refunds, credits, reservations, and delivered inventory must be separately recorded rather than mutating one ambiguous `days` or `credits` field.

### Moderation truth

Payment, moderation, and campaign-delivery states are separate dimensions.

Example valid combination:
- payment: paid;
- moderation: changes requested;
- campaign: awaiting approval;
- inventory: reserved.

### Creative identity and versions

Every creative version used for delivery must be identifiable so performance can be attributed accurately.

AI-generated or edited creative must never silently replace the approved version.

### Inventory

Advertisers request and purchase eligible inventory.

The Command Center manages capacity, reservations, pricing, internal bonuses, blackout periods, overrides, and risk.

Shopper surfaces consume only campaigns that are eligible for that surface and time.

### Analytics

The same event definitions must feed:
- advertiser analytics;
- marketplace analytics;
- Smart Shopper internal analytics.

The aggregation and visibility rules differ, but the underlying event semantics must not.

### Privacy

Private shopper data remains inside Smart Shopper.

Advertisers receive aggregated campaign results, not user identities, shopping lists, private profiles, or sensitive inferred attributes.

### Categories/taxonomy

The advertiser selects structured industries/categories/tags.

The shopper can browse/select categories/interests.

The Command Center owns the governed taxonomy and its version history.

### Experience configuration

The Command Center can configure approved app modules and properties where the application has explicitly exposed configurable surfaces.

It must not inject arbitrary executable code into the consumer application.

## Cross-system lifecycle

A representative end-to-end campaign should work as follows:

1. Advertiser creates a campaign.
2. Advertiser selects category, targeting eligibility, placement, schedule and inventory.
3. Advertiser uploads creative or uses Creative Studio.
4. Advertiser previews exact shopper-facing renderings.
5. Membership entitlements are applied where eligible.
6. Remaining monetary amount is calculated server-side.
7. Advertiser pays and submits in one streamlined transaction.
8. Selected inventory is reserved.
9. Campaign becomes `Paid · Under Review`.
10. Command Center moderation reviews the same campaign object.
11. Admin may approve, request reasonable changes, or reject under policy.
12. Reasonable changes retain payment and reservation for the correction window.
13. Genuine policy rejection follows the defined refund/credit-restoration workflow.
14. Approved campaign is scheduled.
15. Eligible shopper surfaces serve it.
16. Shopper events are collected using the defined analytics contract.
17. Advertiser sees aggregated campaign analytics.
18. Command Center sees advertiser-specific, marketplace, and platform analytics.
19. Optimization opportunities are generated.
20. Advertiser or authorized Admin can reuse, extend, improve, or create a follow-up campaign.

## Shared non-negotiable engineering rules

### Branch-first development

All Promos Marketplace development continues on `feature/promos-marketplace` or a deliberate child branch until explicit merge approval.

Do not develop major feature work directly on `main`.

### Preview before merge

Changes require a branch/staging preview where technically appropriate.

Visual implementation must be reviewed in realistic mobile/desktop context before production merge.

### Design before patchwork

If a material screen/layout is unresolved, create design references or AI-assisted mockups before repeatedly patching implementation code.

### Correctness before speed

Do not bypass proper state modeling, authorization, RLS, financial integrity, concurrency protections, idempotency, audit logging, or rollback simply to finish faster.

### Comments explain intent

Code comments should explain business invariants, non-obvious implementation decisions, safety/security rules, state-machine constraints, retry/idempotency behavior, and architectural boundaries.

Do not fill files with comments that merely restate obvious syntax.

### Failure history is append-only

Meaningful defects must be appended to `FAILURE-LOG.md` with root cause, fix, verification, regression protection, and related prior incidents.

Resolved failures are not deleted.

### Decision history is append-only

Meaningful architecture/product decisions belong in `DECISIONS.md`.

If a decision changes, append a new decision that supersedes the previous one. Do not rewrite history.

### Reversible releases

Use feature flags, staged releases, safe defaults, rollback paths, configuration versioning, and kill switches appropriate to the change.

## Visual relationship between the three products

The three products may use related Smart Shopper brand language, but they should not be forced into identical layouts.

### Shopper
- consumer/mobile-first;
- warm, simple, useful;
- promos integrated into normal Smart Shopper navigation;
- minimal operational complexity exposed.

### Advertiser
- business dashboard;
- responsive web and potentially mobile-accessible;
- campaign creation and analytics are prominent;
- visual analytics and creative workflows are central.

### Command Center
- desktop-first;
- full viewport;
- dedicated domain/login;
- persistent left navigation/top utility rail/status rail where useful;
- dense operational information without becoming visually noisy;
- light theme is preferred for the current direction;
- neon/gem palette is reserved primarily for accents, charts, statuses, icons and data visualization rather than dominating surfaces;
- whitespace and hierarchy are more important than decorative color.

## Source-of-truth precedence

When documents conflict, use this order while the feature remains on the development branch:

1. explicit latest user-approved decision documented in `DECISIONS.md`;
2. relevant component North Star;
3. shared rules in this map;
4. umbrella `README.md`;
5. older prototypes/mockups.

Mockups are design references, not automatic product requirements. Controls shown in a generated image must not be implemented merely because they appear visually; every control must have a defined use case, permission boundary, state impact, and data source.

## Current documentation set

Read these before substantive Promos work:

1. `NORTH-STARS.md`
2. the relevant component North Star:
   - `SHOPPER-EXPERIENCE-NORTH-STAR.md`
   - `ADVERTISER-NORTH-STAR.md`
   - `COMMAND-CENTER-NORTH-STAR.md`
3. `DECISIONS.md`
4. `FAILURE-LOG.md`
5. `DESIGN-SPEC.md`
6. umbrella `README.md` for earlier full-system detail not yet migrated into the component North Stars.

## Documentation workflow going forward

When a new idea is accepted:

1. identify which North Star owns it;
2. update that North Star rather than scattering the requirement across unrelated files;
3. update another North Star only when that system's contract changes;
4. append a decision entry when the change materially affects architecture, business rules, money, permissions, privacy, or state behavior;
5. append failures separately if an implementation issue occurs;
6. keep cross-links explicit.

The goal is not to wait for finality. The goal is to preserve current product truth clearly enough that a new session or engineer can continue without guessing.