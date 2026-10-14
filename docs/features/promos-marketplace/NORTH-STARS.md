# Smart Shopper Promos Marketplace — North Star Map

## Status

- Feature: Promos Marketplace
- Repository: `JLifeOne/Smart-Shopper`
- Development branch: `feature/promos-marketplace`
- Parent whole-product charter: `docs/PRODUCT-NORTH-STAR.md`
- Current implementation snapshot: `docs/SMART-SHOPPER-CURRENT-STATE.md`
- Shared offer/redemption contract: `OFFER-REDEMPTION-CONTRACT.md`
- Production merge policy: no implementation from this feature is merged to `main` until branch preview, testing, design review, and explicit merge approval are complete.
- Document type: living source-of-truth map.
- History policy: this file and the three North Stars may be revised as the product develops. Historical product/engineering decisions belong in `DECISIONS.md`; failures and fixes belong in `FAILURE-LOG.md` and are append-only.

## Product-level boundary

Promos Marketplace inherits from the greater Smart Shopper Product North Star.

Smart Shopper remains first a shopping-execution and shopping-intelligence product. Promos is the commercial marketplace layer built around that utility.

Promos must strengthen shopper usefulness, relevance, and measurable commercial opportunity without turning Smart Shopper into a generic advertising app or corrupting organic price intelligence.

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
- claim/redeem shopper interactions;
- `Why am I seeing this?`;
- privacy-preserving relevance and personalization;
- recommendation/ranking behavior visible to shoppers;
- ad labeling and organic-versus-paid separation;
- saved promos and reminders;
- shopper UI/UX, accessibility, motion, responsive/mobile behavior;
- shopper-side analytics event definitions needed by the other two systems.

Offer allocation, coupon strategies, one-time redemption, QR passes, and verified conversion semantics are governed by `OFFER-REDEMPTION-CONTRACT.md`.

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
- views, viewable impressions, unique reach, opens, likes, saves, shares, CTA actions, claims, redemptions, and verified conversions where evidence exists;
- optimization recommendations;
- A/B creative testing;
- campaign renewal/extension;
- advertiser-facing support and account state;
- privacy boundaries around analytics.

The shared offer/coupon/pass/conversion model is governed by `OFFER-REDEMPTION-CONTRACT.md`.

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
- Ad Inventory & Commercial Pricing;
- paid entitlement integrity and internal bonus/adjustment controls;
- marketplace analytics;
- individual advertiser analytics access;
- Smart Shopper internal/platform analytics;
- redemption/conversion operations and support where applicable;
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

The Command Center manages capacity, reservations, commercial pricing, internal bonuses, blackout periods, overrides, and risk.

Shopper surfaces consume only campaigns that are eligible for that surface and time.

### Offer, claim, redemption, and conversion truth

Save, Claim, Redeem, and Verified Purchase are separate concepts.

A Save is shopper intent.

A Claim allocates or requests a benefit where applicable.

A Redemption records benefit consumption/presentation according to the campaign rules.

A Verified Purchase/Conversion requires stronger evidence and must carry a verification source.

The detailed shared contract is `OFFER-REDEMPTION-CONTRACT.md`.

### Analytics

The same event definitions must feed:
- advertiser analytics;
- marketplace analytics;
- Smart Shopper internal analytics.

The aggregation and visibility rules differ, but the underlying event semantics must not.

A click must not be reported as a verified purchase. Mock/prototype metrics must not be presented as production measurement.

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
3. Advertiser defines any offer/redemption behavior where applicable.
4. Advertiser uploads creative or uses Creative Studio.
5. Advertiser previews exact shopper-facing renderings.
6. Membership entitlements are applied where eligible.
7. Remaining monetary amount is calculated server-side.
8. Advertiser pays and submits in one streamlined transaction.
9. Selected inventory is reserved.
10. Campaign becomes `Paid · Under Review`.
11. Command Center moderation reviews the same campaign object.
12. Admin may approve, request reasonable changes, or reject under policy.
13. Reasonable changes retain payment and reservation for the correction window.
14. Genuine policy rejection follows the defined refund/credit-restoration workflow.
15. Approved campaign is scheduled.
16. Eligible shopper surfaces serve it.
17. Shopper events are collected using the defined analytics contract.
18. If the shopper saves/claims/redeems an offer, the shared offer/redemption contract governs those state transitions.
19. Advertiser sees aggregated campaign analytics and conversion evidence by verification source.
20. Command Center sees advertiser-specific, marketplace, and platform analytics.
21. Optimization opportunities are generated.
22. Advertiser or authorized Admin can reuse, extend, improve, or create a follow-up campaign.

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

1. `docs/PRODUCT-NORTH-STAR.md` for whole-product purpose and product-level boundaries;
2. explicit latest user-approved decision documented in `DECISIONS.md`;
3. relevant component North Star;
4. shared contracts such as `OFFER-REDEMPTION-CONTRACT.md` for their owned semantics;
5. shared rules in this map;
6. umbrella `README.md`;
7. older prototypes/mockups.

If a new decision truly changes the whole-product direction, update the Product North Star deliberately rather than leaving a permanent contradiction.

Mockups are design references, not automatic product requirements. Controls shown in a generated image must not be implemented merely because they appear visually; every control must have a defined use case, permission boundary, state impact, and data source.

## Current documentation set

Read these before substantive Promos work:

1. `docs/PRODUCT-NORTH-STAR.md`
2. `docs/SMART-SHOPPER-CURRENT-STATE.md` when implementation reality matters
3. `NORTH-STARS.md`
4. the relevant component North Star:
   - `SHOPPER-EXPERIENCE-NORTH-STAR.md`
   - `ADVERTISER-NORTH-STAR.md`
   - `COMMAND-CENTER-NORTH-STAR.md`
5. `OFFER-REDEMPTION-CONTRACT.md` when offers, coupons, claims, redemption, ticket links, or conversions are involved
6. `DECISIONS.md`
7. `FAILURE-LOG.md`
8. `DESIGN-SPEC.md`
9. umbrella `README.md` for earlier full-system detail not yet migrated into the component North Stars.

## Documentation workflow going forward

When a new idea is accepted:

1. check that it still aligns with the whole-product North Star;
2. identify which North Star or shared contract owns it;
3. update that owning document rather than scattering the requirement across unrelated files;
4. update another North Star only when that system's contract changes;
5. append a decision entry when the change materially affects architecture, business rules, money, permissions, privacy, measurement, or state behavior;
6. append failures separately if an implementation issue occurs;
7. keep cross-links explicit;
8. refresh the Current-State Reality Map after substantial implementation changes land on `main`.

The goal is not to wait for finality. The goal is to preserve current product truth clearly enough that a new session or engineer can continue without guessing.