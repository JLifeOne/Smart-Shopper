# Promos Marketplace — Phase 0 Visual and Interaction Specification

Status: active design source of truth
Branch: `feature/promos-marketplace`
Parent North Star: `docs/features/promos-marketplace/README.md`

## 1. Purpose

This document converts the Promos Marketplace North Star into concrete screen-level design rules. It exists so future sessions do not improvise layout, hierarchy, labels, states, or interactions.

The first implementation must preserve Smart Shopper's existing visual language. Promos should feel native to Smart Shopper, not like a third-party ad network inserted into the product.

## 2. Existing Smart Shopper design language to preserve

Use the established app tokens unless a deliberate design decision supersedes them:

- primary accent: `#4FD1C5`
- primary ink: `#0C1D37`
- primary surface: `#FFFFFF`
- alternate/background surface: `#F4F7FB`
- secondary text: `#4A576D`
- muted text: `#6C7A91`
- success: `#38A169`
- warning: `#D97706`
- error: `#DC2626`
- card radius: approximately 20px
- larger sheet/modal radius: approximately 28px
- minimum tap target: 44x44

Promo creative may use advertiser colors inside the creative area, but Smart Shopper controls the surrounding UI, actions, disclosures, navigation, and system surfaces.

## 3. Design principles

### 3.1 Advertising must be identifiable
Every paid placement must display `Promoted` or `Sponsored` in a consistent Smart Shopper-controlled position.

### 3.2 The user remains in control
Like, Save, Share, overflow controls, report, hide/not interested, and `Why am I seeing this?` must remain easy to find without overwhelming the creative.

### 3.3 Creative should not swallow the product
The Home Spotlight is visually strong but should not dominate the entire Home screen. Ad density must be controlled.

### 3.4 Intent beats decoration
The card must make the offer, advertiser, validity period, and next action understandable before adding ornamental effects.

### 3.5 Native interactions first
Use Smart Shopper buttons, icons, sheets, spacing, typography, and navigation patterns around advertisements.

## 4. Shopper surface A — Home Promo Spotlight

### 4.1 Placement
Replace the existing Home `Promos spotlight` placeholder with the first functional promo component.

The Home Spotlight is full width within the Home content gutters. Target mobile height is approximately 130–160dp depending on creative density and screen width. Do not use physical inches in code.

### 4.2 Anatomy
Top row:
- `Promoted` disclosure
- advertiser/organization name
- optional verified badge
- overflow menu

Main content:
- campaign headline
- short offer/value proposition
- optional supporting image/artwork area
- validity or urgency line when appropriate, e.g. `Ends Sunday`

Bottom action row:
- Like glyph
- Save glyph
- Share glyph
- primary CTA such as `View promo`, `Claim`, `Get directions`, `Shop offer`, or `Learn more`

### 4.3 Interaction rules
- Like toggles instantly and updates local UI optimistically.
- Save toggles instantly and may later trigger expiry reminders if the user allows notifications.
- Share invokes the native share sheet when available; web fallback copies a campaign link.
- Tapping the card body opens Promo Detail inside Smart Shopper.
- CTA may remain internal or intentionally open an external destination depending on action type.
- Overflow opens a bottom sheet/menu with `Why am I seeing this?`, `Not interested`, `Hide advertiser`, and `Report ad`.

### 4.4 Rotation
The Home Spotlight may rotate eligible campaigns, but never animate aggressively. Automatic rotation must pause while the user interacts with the card and respect reduced-motion preferences.

### 4.5 Empty and failure states
If no eligible promo exists:
- do not show a broken blank banner;
- collapse to a light discovery card or omit the module;
- never show stale expired creative as a fallback unless explicitly marked as cached and still valid.

## 5. Shopper surface B — Promos Feed

### 5.1 Header
- title: `Promos`
- optional subtitle: `Offers picked for you and easy to explore`
- prominent but secondary `Advertise` entry point

### 5.2 Primary tabs / filters
Initial set:
- For You
- Grocery
- Food & Dining
- Tech
- Home
- Auto
- Events
- Services
- More

The taxonomy must remain server-configurable later. Do not hard-code a permanent closed list into business logic.

### 5.3 Feed card anatomy
Each card contains:
- Sponsored/Promoted label
- advertiser name
- optional verified badge
- category
- creative/artwork or Smart Shopper-generated fallback creative
- headline
- concise body copy
- offer validity
- CTA
- Like
- Save
- Share
- overflow

### 5.4 User controls
Feed must support:
- category browsing independent of personalization;
- explicit interests;
- `Not interested`;
- `See fewer like this`;
- `Hide advertiser`;
- report;
- saved promotions;
- later advertiser following.

### 5.5 Explainability
Personalized cards should expose `Why am I seeing this?`.

Example explanations should remain high-level and non-sensitive:
- `You follow Tech deals.`
- `This matches items on a current shopping list.`
- `Popular with shoppers interested in Home.`
- `Shown broadly to Smart Shopper users.`

Never display inferred sensitive traits.

## 6. Shopper surface C — Promo Detail

Promo Detail stays inside Smart Shopper unless the user chooses an external CTA.

Required areas:
- advertiser header
- verified state if applicable
- promoted disclosure
- main creative
- full offer title
- description
- offer dates
- location/service area
- terms/restrictions
- promo code/QR when applicable
- Like / Save / Share
- primary CTA
- secondary CTA options
- report/overflow
- similar/relevant promos in a later phase

Possible CTA types:
- Claim offer
- Copy promo code
- Show QR
- Add advertised item(s) to shopping list
- WhatsApp
- Call
- Directions
- Website
- Book
- Register
- Buy ticket

## 7. Shopper surface D — Saved Promos

Saved promotions need a dedicated view or filter.

Card states:
- active
- ending soon
- expired
- redeemed/claimed, where supported

Recommended behavior:
- allow removing from Saved;
- allow optional expiry reminder;
- expired promos remain visible for a limited history period but cannot masquerade as active.

## 8. Advertiser surface A — Entry and account conversion

`Advertise on Smart Shopper` must be accessible from the Promos area and advertiser-oriented account surfaces.

A normal shopper account may become an advertiser without creating an entirely separate Smart Shopper identity.

First-time advertiser setup:
- promoter/organization display name
- advertiser type
- contact information
- optional legal/business information depending on verification policy
- logo/profile image
- category/industry
- billing country/currency
- acceptance of advertising terms

## 9. Advertiser surface B — Dashboard

### 9.1 Dashboard navigation
- Overview
- Campaigns
- Create Campaign
- Drafts
- Under Review
- Changes Requested
- Scheduled
- Live
- Completed
- Saved Creatives
- Promo Credits
- Billing
- Analytics
- Recommendations
- Account / Verification
- Support

### 9.2 Overview
Top KPIs:
- Active campaigns
- Current reach
- Likes
- Saves
- Shares
- CTA actions
- Claims/redemptions when supported
- remaining Promo Days/credits

Below KPIs:
- campaign performance cards
- alerts requiring advertiser action
- AI/algorithm recommendations
- recent payments
- campaign ending soon

### 9.3 Campaign card
- name
- status
- placement
- date range
- time slot
- spend or entitlement consumption
- impressions
- engagement rate
- saves
- CTA actions
- `View analytics`
- `Reuse campaign`

### 9.4 Reuse campaign
Reuse creates a NEW draft with copied configuration and creative. Historical analytics remain attached to the original campaign.

The new draft must force the advertiser to review:
- dates
- prices
- offer validity
- inventory availability
- targeting
- creative still-current state

## 10. Advertiser surface C — Create Campaign flow

The campaign builder is a guided multi-step flow.

### Step 1 — Campaign basics
- internal campaign name
- advertiser identity
- campaign category
- offer type
- headline
- description
- dates

### Step 2 — Creative
- upload artwork/image
- optional logo
- Smart Shopper-generated fallback creative if no artwork is supplied
- preview crop/safe-area checks

Future AI assistance may suggest layouts/copy, but advertiser must approve final creative.

### Step 3 — Action
Choose CTA:
- View details
- Claim
- Call
- WhatsApp
- Website
- Directions
- Register
- Book
- Buy ticket
- Add to list, where product data supports it

### Step 4 — Audience and relevance
- industry/category tags
- product/topic tags
- geographic eligibility
- broad audience option
- category targeting
- contextual/list-match eligibility

The advertiser defines campaign intent. Smart Shopper does not expose shopper identities.

### Step 5 — Placement and inventory
- Promos Feed
- Home Spotlight
- Featured placement
- future category takeover/special inventory if approved
- campaign duration
- time slot
- frequency/pacing rules where applicable

### Step 6 — Entitlements and price
Show clearly:
- gross campaign price
- included Premium/plan entitlement used
- additional Promo Days/credits purchased
- tax/fees where applicable
- total due now

### Step 7 — Final preview and policy confirmation
Advertiser sees:
- Home preview if selected
- feed preview
- detail preview
- campaign summary
- terms/policy confirmation

### Step 8 — Payment + submission
Payment and submission are one streamlined flow.

After successful payment/entitlement reservation:
- payment state becomes paid or entitlement-consumed;
- inventory reservation is created;
- moderation state becomes under review;
- advertiser sees a confirmation and expected next state.

Minor corrections do not cancel the transaction.

## 11. Advertiser surface D — Analytics

Organize analytics around a funnel:

Reach → Interest → Intent → Action → Outcome

### Reach
- impressions
- unique reach
- frequency

### Interest
- opens
- likes
- engagement rate

### Intent
- saves
- shares
- claims

### Action
- CTA clicks
- WhatsApp/call/directions/website actions

### Outcome
- verified redemption when supported
- advertiser-provided conversion integration in later phases

Trend views:
- by day
- by time period
- by placement
- by category
- by broad geographic area where privacy thresholds allow

Advertiser never receives private shopper lists or identifiable interest profiles.

## 12. Advertiser optimization assistant

The assistant may surface recommendations such as:
- high reach, weak engagement: revise creative/relevance;
- high saves, weak CTA: strengthen CTA/offer clarity;
- strong evening performance: consider evening inventory;
- frequency rising with falling engagement: creative fatigue;
- campaign performing well: extend or reuse;
- product/list-match audience performing strongly: preserve relevant tags;
- campaign rejected/flagged: explain policy issue clearly.

Material changes require advertiser confirmation.

## 13. Admin surface A — Authentication and roles

Admin must not use a hidden client-only route as security.

Roles should support least privilege:
- Moderator
- Support
- Finance
- Admin
- Super Admin

Strong authentication and server-side authorization are mandatory in production.

## 14. Admin surface B — Operations dashboard

Primary modules:
- Review Queue
- Changes Requested
- Awaiting advertiser response
- Approved / Scheduled
- Live
- Paused
- Expiring
- Completed
- Rejected
- Refund Queue
- Reports / Trust & Safety
- Advertisers
- Campaign Inventory
- Revenue / Finance
- Entitlements / Promo Credits
- Categories / Taxonomy
- Policy Rules
- Customer Support
- Audit Log
- System Controls

## 15. Admin moderation detail

Moderation view should show side-by-side where space permits:
- submitted information
- rendered Home preview
- rendered feed preview
- rendered detail preview
- advertiser history
- payment state
- slot reservation
- policy checklist
- automated safety signals as advisory only

Actions:
- Approve
- Request changes
- Reject + refund/restore entitlement
- Edit administrative metadata
- Schedule
- Pause
- End campaign
- Escalate to senior review

Requesting changes must preserve the paid campaign and reserved inventory for the configured correction window.

## 16. Admin advertiser/customer support view

A support/admin view should provide:
- advertiser profile
- verification state
- contact/support history
- campaigns
- payments
- entitlements
- refunds
- moderation history
- policy strikes/warnings
- notes with author/timestamp
- account restrictions

Do not expose shopper-level private targeting data here unless a narrowly defined security/debugging need is approved and audited.

## 17. Admin inventory calendar

Premium placements and time slots require inventory controls.

View should support:
- day/week calendar
- placement lane
- slot capacity
- reserved
- paid under review
- scheduled
- live
- blocked/admin-reserved inventory

Double-selling the same exclusive inventory must be prevented transactionally in production.

## 18. Admin finance view

Required:
- paid campaigns
- pending/failed payments
- refunds
- partial refunds
- plan entitlement consumption
- manual/admin credits
- payment provider references
- reconciliation status
- disputes/chargebacks when supported

Financial actions require audit logs.

## 19. Admin safety and emergency controls

Super Admin controls should include:
- pause all promos;
- pause a placement;
- pause advertiser;
- disable campaign submission;
- disable new payments;
- disable personalized ranking and fall back to contextual/broad ranking;
- remove a campaign immediately;
- place categories or advertisers into review-only mode.

Every emergency action records actor, timestamp, reason, and previous state.

## 20. Personalization controls

User preference surface should support:
- explicit interests
- categories to see more often
- categories to see less often
- hidden advertisers
- saved promos
- personalization toggle/configuration as policy requires
- explanation of general/platform-wide sponsored content

Personalization must use multiple interests. It must not classify a user as one identity.

## 21. Ranking UX requirements

Initial ranking must be explainable and deterministic enough to debug.

Candidate signals:
- exact current list match
- related current-list/category match
- explicit followed interest
- recent non-sensitive interest
- long-term non-sensitive interest
- broad geographic relevance
- campaign quality
- freshness
- exploration/discovery budget
- frequency/fatigue penalty
- negative-feedback penalty
- advertiser/campaign blocks

Hard filters execute before scoring:
- campaign live status
- start/end time
- placement eligibility
- inventory state
- geography
- policy state
- user blocks
- frequency caps

## 22. Interaction telemetry

Every meaningful interaction should have a stable event name and campaign identifier.

Minimum conceptual events:
- promo_impression
- promo_open
- promo_like
- promo_unlike
- promo_save
- promo_unsave
- promo_share
- promo_cta
- promo_claim
- promo_hide
- promo_not_interested
- promo_report
- why_this_promo_open

Avoid logging private raw list contents into generic analytics events.

## 23. Accessibility

- 44x44 minimum action targets
- accessible labels for Like/Save/Share state
- do not rely on color alone for status
- focus order follows content hierarchy
- creative images require advertiser-supplied or generated alt text in production
- reduced motion respected
- text scaling should not clip campaign CTA or disclosure

## 24. Prototype constraints

The first PWA/branch prototype is intentionally non-production:
- mock campaign data
- local state
- simulated payment/moderation where demonstrated
- no real shopper targeting
- no real payment credentials
- no real moderation authorization

The prototype exists to validate interaction, hierarchy, workflow, and visual direction before production schema/API work.

## 25. Design acceptance gate before production backend work

Do not move the full production backend ahead of unresolved design fundamentals.

The following must be testable in preview:
- Home Spotlight readability and height
- Like/Save/Share ergonomics
- Promos feed category navigation
- Promo Detail hierarchy
- advertiser dashboard comprehension
- create-campaign flow comprehension
- payment-at-submit mental model
- admin review workflow
- status labels
- mobile and desktop responsiveness

If a surface remains visually weak or ambiguous, create a visual reference/mockup before implementing the production version.
