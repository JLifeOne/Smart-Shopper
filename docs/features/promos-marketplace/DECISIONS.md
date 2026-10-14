# Promos Marketplace Decision Log

This file is append-only. Do not delete or rewrite historical decisions. If a decision changes, add a new dated entry that references the earlier decision and explains why it changed.

## 2026-10-13 - Initial product decisions

### D-001 - Promos is a first-party Smart Shopper marketplace
Decision: Build Promos as a Smart Shopper product surface using Smart Shopper's own shopper context, advertiser tools, moderation, analytics, and ranking. Do not treat it as a generic third-party banner-ad integration.

Reason: The value proposition depends on matching useful promotions to shopping intent while preserving Smart Shopper's product context and privacy controls.

### D-002 - Dedicated shopper surfaces
Decision: Promos will appear in a Home Promo Spotlight and a dedicated Promos tab/feed.

### D-003 - Pay-per-campaign is available without Premium
Decision: A user does not need Premium membership to advertise. An eligible user may purchase an individual campaign directly.

### D-004 - Premium may include advertising entitlements
Decision: Premium plans may grant Promo Days, credits, placement benefits, or time-slot allowances. If the campaign exceeds the user's entitlement, the user may pay the difference.

### D-005 - No assumed unlimited advertising plan
Decision: Do not design campaign inventory around unlimited subscription advertising. Entitlements must be measurable and capacity-aware.

### D-006 - Payment occurs at submission
Decision: Campaign payment or entitlement consumption is completed as part of the submission flow before moderation finishes.

Reason: Requiring an approved advertiser to return later for checkout creates unnecessary conversion loss.

### D-007 - Minor changes preserve payment
Decision: `changes_requested` does not cancel payment. The advertiser may revise and resubmit under the existing transaction when the requested change is within the campaign's original purchased scope.

### D-008 - Rejection may trigger refund / credit restoration
Decision: Genuine policy rejection follows the documented refund policy. Eligible Promo Credits / Promo Days are restored according to policy.

### D-009 - Separate state machines
Decision: Payment status, moderation status, and campaign-delivery status must remain separate.

### D-010 - Reserve scarce inventory after payment
Decision: Paid scarce placements / time slots should be reserved while moderation occurs, with a documented release and grace-period policy.

### D-011 - Broad advertiser eligibility
Decision: Advertisers may include registered businesses, sole traders, individuals, churches, nonprofits, event organizers, service providers, retailers, and other policy-compliant promoters.

### D-012 - Advertiser dashboard
Decision: Advertisers receive a dedicated dashboard for campaigns, billing / entitlements, analytics, recommendations, reuse, support, and status tracking.

### D-013 - Campaign reuse
Decision: Previous campaigns can be duplicated into new drafts. Historical analytics remain attached to the original campaign ID.

### D-014 - Core shopper engagement signals
Decision: Like, Save, Share, Open, CTA, Hide / Not Interested, and Report are first-class actions. Save and Share are treated as stronger positive signals than a passive impression.

### D-015 - Saved Promos recommended
Decision: Provide a shopper-facing Saved Promos area with expiry visibility and optional reminders.

### D-016 - Advertiser analytics are aggregated
Decision: Advertisers see campaign performance, not identifiable shopper data or private shopping lists.

### D-017 - Industry/category/topic taxonomy
Decision: Campaign submission requires structured classification so Smart Shopper can support browsing, targeting, moderation, reporting, and ranking.

### D-018 - Explicit shopper interests
Decision: Users may choose multiple categories they want to see. The algorithm supplements, rather than replaces, explicit preference control.

### D-019 - Multi-interest personalization
Decision: The ranking system maintains multiple interest weights and separates long-term interest from recent intent and active-list intent.

### D-020 - Current list intent is a high-value signal
Decision: Where privacy and user controls allow, a live shopping-list match can outrank broad inferred affinity because it represents immediate purchase intent.

### D-021 - Sensitive traits are excluded from ad personalization
Decision: Smart Shopper must not infer or target religion, race / ethnicity, health conditions, political affiliation, sexual orientation, sex life, criminal history, trade union membership, or similar sensitive attributes.

### D-022 - Admin may run broad campaigns
Decision: Admin can designate general / platform-wide campaigns, but these remain labeled, frequency-capped, audited, and subject to safety rules.

### D-023 - AI assists; humans approve material changes
Decision: AI/ML may recommend better creative, targeting, timing, or campaign settings, but may not silently alter budget, duration, creative, targeting, or schedule.

### D-024 - Dedicated secure admin web console
Decision: Admin operations should use a dedicated role-gated web interface rather than hidden consumer-app controls.

### D-025 - Branch-first development
Decision: Promos development occurs on `feature/promos-marketplace` or approved child branches. Do not merge to `main` without explicit instruction after preview and verification.

### D-026 - Visual quality requires a deliberate design process
Decision: If a surface cannot be represented properly during implementation, create an AI-assisted design reference first, approve the direction, document it, then implement against it.

### D-027 - Append-only failure history
Decision: Feature failures and fixes are retained chronologically. Do not delete older incidents after fixing them.

### D-028 - Robustness over shortcuts
Decision: Security, state integrity, comments for non-obvious logic, tests, observability, and rollback paths are required parts of the feature, not post-launch cleanup.

### D-029 - Rules-based ranking before ML
Decision: Start with deterministic explainable ranking. Introduce learned ranking only after enough trustworthy interaction data exists and a deterministic rollback remains available.

### D-030 - Privacy-first first-party architecture
Decision: Prefer first-party recommendation and measurement inside Smart Shopper. Do not expose private user profiles to advertisers and do not introduce third-party cross-app tracking by default.

## 2026-10-13 - North Star split and expanded operating model

### D-031 - Three interconnected North Stars
Decision: Split Promos Marketplace documentation into three living North Stars: Shopper Experience, Advertiser Experience, and Command Center. Maintain a shared North Star map describing cross-system contracts.

Reason: Each component is large enough to be designed and implemented independently while still sharing campaign, commercial, creative, inventory, analytics, taxonomy, and privacy truth.

### D-032 - Command Center is a separate desktop-first product
Decision: The internal operating console is not an admin page inside the consumer app. It is a separate desktop-first web product intended for a dedicated domain such as `admin.smartshopper.com`, with separate internal authentication, roles, audit history, and deployment boundary.

### D-033 - Command Center controls approved app configuration, not arbitrary code
Decision: Experience Manager may configure engineering-approved consumer-app modules, properties, ordering, schedules, targeting, style variants, fallback behavior, feature flags, and publish/rollback state. It may not inject arbitrary executable code or bypass application business logic.

### D-034 - Commercial Agreement and Delivery Plan remain distinct
Decision: Preserve what an advertiser actually purchased separately from how Smart Shopper ultimately delivers the campaign. Complimentary days, upgrades, goodwill credits, refunds, and other internal changes must be recorded as auditable adjustments rather than rewriting purchased truth.

### D-035 - Admin may add controlled bonuses and incentives
Decision: Authorized internal roles may grant additional Promo Days, inventory, credits, upgrades, extensions, or similar incentives without requiring the advertiser to configure them. These actions must be reasoned, permission-controlled, value-limited where appropriate, and auditable.

### D-036 - Analytics has three internal perspectives
Decision: Command Center Analytics must distinguish: (1) individual Advertiser Analytics, (2) cross-advertiser Marketplace Analytics, and (3) Smart Shopper Platform Analytics. These views answer different business questions and must not be conflated.

### D-037 - Analytics is visual-first
Decision: Advertiser and Command Center analytics should always include meaningful graphics such as trends, funnels, comparisons, heatmaps, occupancy views, and cohorts where appropriate. Metric cards support the visuals but do not replace them.

### D-038 - View measurement is a first-class event model
Decision: Track raw impressions, viewable impressions, Promo Detail opens, unique reach, repeat exposure/frequency, and engagement events separately. Advertisers receive aggregate view/reach analytics rather than individual viewer identities.

### D-039 - Creative Studio is a controlled production system
Decision: Build Creative Studio around Smart Shopper-owned structured templates, Brand Profiles, deterministic rendering of logos/prices/dates/CTA text, AI-assisted asset generation/editing, creative versioning, preview-in-context, quality checks, approval workflow, and later performance feedback/A-B testing. Do not rely on unconstrained AI image generation as the final commercial renderer.

### D-040 - Current Command Center visual direction is light and restrained
Decision: The current preferred Command Center direction is a light desktop interface with generous whitespace. Neon/gem colors such as light yellow, blue, dark blue, purple, pink, red, and gray are used selectively for charts, icons, statuses, highlights, and decorative accents rather than dominating surfaces.

### D-041 - Generated mockups are references, not requirements
Decision: A control shown in an AI-generated UI image is not automatically a product requirement. A control must have a real operational use case, permission boundary, state/data impact, and source of truth before implementation.

### D-042 - Documentation should capture current truth before finality
Decision: Do not wait for every area to be finalized before documenting it. Lock accepted current direction into the appropriate living North Star and revise it as needed. Use the append-only decision and failure logs to preserve historical reasoning and implementation lessons.

## 2026-10-13 - Whole-product direction, offers, redemption, and measurement integrity

### D-043 - Smart Shopper has a product-level North Star above Promos
Decision: `docs/PRODUCT-NORTH-STAR.md` is the highest-level product charter. The three Promos North Stars inherit from it and must not silently redefine Smart Shopper's purpose.

Reason: Promos is strategically large and monetizable, but Smart Shopper remains first a shopping-execution and shopping-intelligence product. A feature should not become the product's identity merely because it is the current development focus.

### D-044 - Promos must strengthen shopping utility rather than replace it
Decision: Build Promos around Smart Shopper's existing shopping context. Do not rebuild Smart Shopper around advertising. Home and organic shopping intelligence must remain useful independent of paid campaigns.

### D-045 - Save, Claim, Redeem, and Verified Purchase are separate states/events
Decision: A saved promotion is intent, a claimed offer is allocated benefit, redemption is consumption/presentation of the benefit, and verified purchase/conversion requires stronger evidence. Do not report one stage as another.

Reason: Honest funnel semantics are necessary for advertiser trust and meaningful conversion analytics.

### D-046 - Physical one-time offers are server-authoritative
Decision: Smart Shopper-issued Promo Passes/coupons use unique server-backed identifiers. The backend, not the displayed QR/code or client state, determines whether an offer is valid, expired, already redeemed, or has uses remaining. Redemption must be atomic and replay-safe.

### D-047 - Support universal codes, merchant unique-code pools, and Smart Shopper Promo Passes
Decision: The offer system should support at least three strategies: (1) universal merchant codes, (2) merchant-supplied unique code pools allocated by Smart Shopper, and (3) Smart Shopper-issued QR/token Promo Passes for physical or low-integration merchants.

Reason: This accommodates sophisticated online merchants and small local businesses without requiring every advertiser to integrate a POS or commerce API.

### D-048 - Smart Shopper will not initially become the merchant of record for tickets or advertiser purchases
Decision: Event tickets, ecommerce purchases, service bookings, and similar transactions normally complete on the advertiser's existing site/provider. Smart Shopper tracks outbound actions and receives conversion evidence where available rather than taking on ticket issuance, settlement, chargebacks, fulfillment, or merchant liability.

### D-049 - Conversion evidence must carry a verification source
Decision: Advertiser analytics should distinguish evidence such as `Smart Shopper Verified`, `Partner Verified`, `Advertiser Reported`, and `Click Attribution Only`. Do not blend weak and strong attribution into an unexplained conversions number.

### D-050 - Tracked outbound redirects are part of external attribution
Decision: Where feasible, external website/ticket CTAs should pass through a Smart Shopper tracking/redirect layer so campaign, creative, placement, and click attribution can be measured without exposing private shopper context. A tracked click is not itself a verified sale.

### D-051 - Real analytics infrastructure is a foundational requirement
Decision: Current in-memory mobile analytics plumbing is not sufficient for advertiser reporting. Before production Promos analytics, build a durable, versioned, privacy-classified event ingestion and aggregation pipeline. Mock/prototype charts must not be represented as production measurement.

### D-052 - Promo entitlements require a general commercial ledger, not menu-specific premium flags
Decision: Do not attach Promo Days or advertising privileges directly to menu-specific premium state such as `is_menu_premium`. Build a general entitlement/ledger model with server authority, reservations, consumption, restoration, expiration, and audited adjustments while reusing proven server-side enforcement patterns where appropriate.

### D-053 - Advertising pricing must be named separately from consumer product pricing
Decision: Prefer `Ad Inventory & Commercial Pricing` (or equivalently explicit terminology) for the Command Center advertising-rate module. Smart Shopper already uses product/store price intelligence and price tiers, so generic `Pricing` risks semantic confusion.

### D-054 - Current implementation reality is documented separately from durable product direction
Decision: Maintain `docs/SMART-SHOPPER-CURRENT-STATE.md` as a dated reality map of implemented, partial, placeholder, and missing systems. Do not turn temporary implementation gaps into permanent North Star rules.

### D-055 - Offer and redemption behavior has one shared cross-system contract
Decision: `OFFER-REDEMPTION-CONTRACT.md` owns the shared Save → Claim → Redeem → Verified Purchase semantics, code strategies, physical redemption, ticket/external attribution, verification labels, fraud/privacy rules, and V1 scope. Shopper, Advertiser, and Command Center surfaces should implement that shared truth rather than inventing separate redemption meanings.