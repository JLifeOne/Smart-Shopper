# Smart Shopper Promos — Advertiser Experience North Star

## Status

- Component: advertiser-facing Promos Marketplace
- Parent feature: Promos Marketplace
- Development branch: `feature/promos-marketplace`
- Document type: living specification
- Related North Stars:
  - `SHOPPER-EXPERIENCE-NORTH-STAR.md`
  - `COMMAND-CENTER-NORTH-STAR.md`
- Shared map: `NORTH-STARS.md`

## 1. Purpose

The advertiser experience should allow an eligible advertiser to create, fund, submit, improve, reuse, measure, and extend campaigns with low friction while preserving commercial integrity and shopper privacy.

The advertiser should feel that Smart Shopper is helping generate outcomes, not merely selling impressions.

## 2. North Star outcome

An advertiser should be able to:
- establish an advertiser profile;
- create a campaign without being a Premium subscriber;
- select what is being promoted;
- choose placement, dates, time windows, category, region and allowed audience criteria;
- upload artwork optionally;
- use Smart Shopper Creative Studio when artwork is absent or needs improvement;
- preview exactly how the campaign will appear in shopper surfaces;
- apply included Promo Days/credits where eligible;
- pay any remaining amount and submit in one transaction;
- see `Paid · Under Review` immediately after successful submission;
- respond to reasonable requested changes without repurchasing;
- track campaign status;
- see meaningful visual analytics;
- understand views, reach, engagement and conversion signals;
- reuse successful campaigns;
- receive optimization recommendations;
- extend or create follow-up campaigns;
- trust that purchased delivery and bonus adjustments are accounted for accurately.

## 3. Advertiser eligibility and profile

`Advertiser` is intentionally broader than `Business`.

Supported types may include:
- registered business;
- retailer;
- supermarket;
- restaurant;
- sole trader / solopreneur;
- service provider;
- event organizer;
- nonprofit/community group;
- church/faith organization where policy-compliant;
- school/education provider;
- online seller;
- individual seller where permitted;
- verified brand;
- other policy-compliant promoter categories.

The account should capture appropriate identity and contact information without forcing every advertiser into a corporation-style form.

## 4. Advertiser dashboard

The advertiser receives a dedicated dashboard after entering the advertising experience.

Core navigation should include:
- Overview;
- Campaigns;
- Create Campaign;
- Drafts;
- Under Review;
- Changes Requested;
- Scheduled;
- Live;
- Completed / Past Campaigns;
- Creative Studio / Creative Library;
- Promo Days / Credits;
- Billing / Payments;
- Analytics;
- Recommendations;
- Account / Verification;
- Support.

The exact navigation may collapse sections based on account maturity and screen size.

## 5. Campaign creation workflow

### Step 1 — Promotion details

Capture:
- campaign name for internal advertiser use;
- advertiser/promoter identity;
- industry/category;
- promotion type;
- headline;
- description;
- offer/value proposition;
- start/end dates;
- locations/service area;
- structured product/service tags where relevant;
- terms/exclusions;
- CTA type and destination.

### Step 2 — Creative

Creative upload is optional.

Advertiser can:
- upload image/artwork;
- select existing creative;
- reuse previous creative;
- use Brand Profile;
- generate Smart Shopper template-based creative;
- request AI-assisted variations;
- preview multiple formats.

### Step 3 — Placement and inventory

Advertiser selects from inventory exposed as eligible and available.

Potential placement types:
- Promos Feed;
- Home Spotlight + Feed;
- Home Spotlight;
- Category Featured;
- Search Sponsored;
- Featured Evening;
- other future approved placements.

Potential duration/time concepts:
- number of campaign days;
- all-day;
- morning;
- midday;
- evening;
- weekend;
- selected configured time windows.

Potential scope concepts:
- region;
- eligible locations;
- campaign category;
- permitted audience-interest/context criteria.

### Step 4 — Entitlements and price

The system calculates pricing server-side.

Membership/purchased entitlements are applied before monetary top-up where configured.

Example:
- campaign requires 15 Promo Days;
- advertiser has 13 eligible Promo Days;
- system applies 13;
- advertiser pays for remaining 2.

Or:
- campaign price: JMD $6,000;
- included advertising value: JMD $4,500;
- due today: JMD $1,500.

The client must not be trusted to calculate or declare the final payable amount.

### Step 5 — Preview

Advertiser sees exact or highly faithful previews of:
- Home Spotlight where selected;
- Promos Feed;
- Promo Detail;
- mobile and supported web surfaces;
- relevant aspect-ratio variants.

Advertiser confirms campaign facts and policy acknowledgement.

### Step 6 — Payment + submit

Payment and submission are one streamlined conversion event.

Locked principle:

> Campaign submission and payment are one streamlined transaction. Moderation occurs after payment. Minor corrections preserve the transaction. Genuine policy rejection triggers the applicable refund or advertising-credit restoration workflow.

The selected inventory should be reserved at successful payment/submission.

The user should see:

`Paid · Under Review`

and, where appropriate:

`Your placement is reserved while your promotion is reviewed.`

## 6. Payment/moderation/delivery are separate state dimensions

### Payment status

Recommended state model:
- pending;
- paid;
- partially_refunded;
- refunded;
- failed.

### Moderation status

Recommended state model:
- draft;
- under_review;
- changes_requested;
- approved;
- rejected.

### Campaign delivery status

Recommended state model:
- awaiting_approval;
- scheduled;
- live;
- paused;
- completed;
- cancelled.

A campaign can validly be:
- paid;
- changes requested;
- inventory reserved;
- not yet live.

Do not collapse these concepts into one overloaded `status` field.

## 7. Review outcomes

### Approve

Campaign becomes eligible for scheduling/delivery according to purchased/reserved inventory.

### Request changes

This is not automatically a rejection.

Reasonable corrections should preserve:
- payment;
- campaign object;
- reserved inventory for the configured correction window;
- purchased entitlements.

### Reject

Genuine prohibited-content/policy rejection may trigger:
- refund according to policy;
- restoration/release of unused advertising entitlement;
- inventory release;
- audit entry.

The exact refund SLA/provider behavior remains a separate commercial/technical decision.

## 8. Commercial integrity and entitlement ledger

Do not model entitlement using only `user.isPremium` or a mutable `campaign.days` field.

The advertiser system needs auditable entitlement accounting.

Conceptual records may include:
- source: subscription / purchased / promotional credit / admin adjustment;
- placement eligibility;
- granted units/days/value;
- reserved units;
- consumed units;
- valid-from;
- expires-at;
- campaign linkage;
- financial transaction linkage.

Purchased commercial truth must remain identifiable even when Smart Shopper grants extra delivery.

Example:

Purchased:
- 7 Home Spotlight days.

Admin adjustment:
- +3 complimentary Home Spotlight days.

Effective delivery:
- 10 days.

Historical record must continue showing that only 7 were purchased and 3 were complimentary.

## 9. Campaign reuse

Every eligible completed/previous campaign should support `Reuse Campaign`.

Reuse creates a new draft while copying selected fields such as:
- campaign structure;
- creative reference;
- category;
- CTA;
- targeting eligibility;
- placements;
- schedule preferences.

The original analytics remain attached to the original campaign.

Historical performance must never be merged into the new campaign's metrics simply because it was duplicated.

## 10. Creative Studio

Creative Studio is a first-class part of the advertiser experience.

It is not simply an image-generation button.

### 10.1 Core architecture

Smart Shopper should own:
- editor UI;
- structured campaign facts;
- template/layout engine;
- logo placement;
- pricing/date/CTA text rendering;
- format adaptation;
- version history;
- approval workflow;
- final export/rendering.

AI may assist with:
- visual generation;
- background creation/editing;
- copy refinement;
- layout suggestions;
- variant generation;
- quality recommendations.

Commercial truth such as price, dates, business logo and CTA should be deterministic layers rather than trusting an image model to redraw them accurately.

### 10.2 Brand Profile

Advertisers should maintain reusable brand data:
- logo(s);
- brand colors;
- approved assets;
- preferred visual style;
- optional typography rules;
- business/category information;
- previous creatives;
- CTA preferences;
- contact destinations.

### 10.3 Template families

Examples:
- Offer Focus;
- Product Focus;
- Premium Minimal;
- Event Promo;
- Food/Restaurant;
- Retail Sale;
- Service Promotion.

Templates provide quality consistency and responsive safe areas.

### 10.4 Format generation

One campaign may generate/adapt creatives for:
- 1:1;
- 4:5;
- 16:9;
- 9:16;
- Home Spotlight;
- Promos Feed;
- other Smart Shopper placement-specific formats.

### 10.5 Creative quality checks

The Studio should inspect:
- resolution;
- aspect ratio;
- crop/safe areas;
- text overflow;
- spacing/alignment;
- contrast/readability;
- minimum text size;
- logo integrity;
- CTA prominence;
- campaign dates/offer presence;
- required disclosures;
- mobile readability;
- brand consistency.

A readiness score may be shown, but it must be explained as a quality heuristic, not a guarantee of campaign performance.

### 10.6 Creative workflow

Recommended states:
- Draft;
- Review;
- Approved Creative;
- Ready to Publish;
- Archived/Superseded where appropriate.

Every delivered creative version must remain identifiable for analytics attribution.

### 10.7 A/B testing

Advertiser may eventually compare approved creative variants using bounded traffic allocation.

Performance should be measured using meaningful outcomes such as:
- viewable impressions;
- opens;
- save rate;
- CTA rate;
- claims/redemptions where available.

AI/admin may recommend a winner, but material budget/delivery changes require appropriate authorization.

## 11. Advertiser analytics

Analytics should be visual-first, not a wall of boxed numbers.

### 11.1 Required visual types

Potential core visuals:
- impressions/viewable impressions over time;
- engagement trend;
- funnel;
- placement comparison;
- time-of-day/day-of-week heatmap;
- campaign comparison;
- creative comparison;
- category/region performance where privacy thresholds allow;
- repeat/retention/renewal trends.

Motion should be subtle and useful:
- smooth chart entrance;
- tooltip hover/tap;
- filter transitions;
- animated state changes;
- reduced-motion support.

### 11.2 Visual styling

Current preferred direction:
- premium light dashboard surfaces;
- substantial whitespace;
- dark text;
- neon/gem colors used with restraint as decorative accents, chart series, icons, highlights and status states;
- preferred accent family includes light yellow, blue, dark blue, purple, pink, red and gray;
- avoid flooding the interface with gradients/colors;
- charts may use gradient fills/strokes selectively.

### 11.3 Core metrics

At minimum:
- raw impressions;
- viewable impressions;
- unique reach;
- average frequency;
- Promo Detail opens;
- likes;
- saves;
- shares;
- CTA actions;
- claims;
- redemptions where measurable;
- engagement rate;
- view-to-open rate;
- cost per meaningful action where monetary data permits;
- spend/entitlement consumption;
- remaining Promo Days/credits.

### 11.4 Funnel

A campaign may display:

`Impressions → Viewable Impressions → Promo Opens → Likes/Saves/Shares → CTA Actions → Claims/Conversions`

Not every campaign supports every stage.

### 11.5 Privacy

Advertiser analytics are aggregated.

Advertisers do not receive a list of individual shoppers who viewed, liked, saved or clicked an ad.

## 12. Optimization assistance

Smart Shopper should help advertisers improve outcomes.

Examples:
- strongest engagement occurs 5–9 PM;
- high impressions but low opens suggest creative/relevance weakness;
- strong saves but low CTA actions suggest offer/CTA weakness;
- campaign fatigue appears after repeated exposure;
- one placement materially outperforms another;
- previous creative should be reused;
- a campaign is performing strongly enough to consider extension.

Recommendations should be explainable and based on available evidence.

The system must not silently change:
- budget;
- spend;
- targeting;
- dates;
- creative;
- placement;
- campaign duration.

Advertiser or authorized Admin approval is required for material changes.

## 13. Campaign scorecard

A simple advertiser-facing mental model should be:

`Reach → Interest → Intent → Action`

Example:
- impressions/reach;
- opens/likes;
- saves/shares;
- CTA/claims/redemptions.

The dashboard should help explain where the funnel is weakening.

## 14. My Promotions / campaign management

Advertiser should be able to see:
- Active;
- Under Review;
- Changes Requested;
- Scheduled;
- Completed;
- Drafts;
- campaign details;
- reserved/delivered dates;
- payment state;
- entitlements used;
- remaining allowance;
- creative version;
- analytics;
- reuse/extend actions.

## 15. Renewal and lifecycle support

The system should encourage appropriate repeat advertising without becoming spammy.

Potential prompts:
- campaign expiring soon;
- strong campaign with no follow-up scheduled;
- high-performing creative available for reuse;
- unused Promo Days nearing expiration;
- recommendation for an appropriate placement/time window.

## 16. Support and transparency

Advertiser should have access to:
- campaign status explanation;
- moderation feedback;
- payment receipts/history;
- credit/Promo Day ledger summary;
- support/contact channel;
- policy references;
- refund/credit status where applicable.

## 17. Relationship to the Command Center

Authorized internal staff may perform advertiser-equivalent actions on behalf of the advertiser plus additional controlled actions such as:
- grant complimentary days;
- issue credits;
- upgrade placement;
- extend a campaign;
- reserve inventory manually;
- pause for policy reasons;
- refund;
- generate creative;
- create optimization proposal;
- view advertiser analytics;
- add internal notes.

These internal actions require role checks and audit history.

## 18. Relationship to shopper experience

Advertiser previews must match real shopper surfaces.

Advertiser targeting never provides direct access to private shopper profiles.

Shopper engagement events feed advertiser analytics only through permitted aggregation.

## 19. V1 acceptance direction

A credible V1 advertiser experience should demonstrate:
- advertiser profile;
- Create Campaign flow;
- optional artwork;
- template-based generated creative;
- placement/duration selection;
- Promo Day/credit calculation;
- pay-and-submit flow;
- `Paid · Under Review` status;
- My Promotions dashboard;
- reuse campaign;
- basic advertiser analytics with real charts;
- views/viewable impressions/opens/likes/saves/shares;
- privacy-safe aggregates;
- preview in shopper context.

## 20. Open questions that must not be guessed

- payment provider;
- exact campaign prices;
- Premium advertising allowances;
- exact entitlement unit model where placements have unequal value;
- refund SLAs;
- advertiser verification thresholds;
- restricted industries/products;
- conversion attribution window;
- exact creative-generation API stack;
- final A/B testing thresholds;
- whether advertisers can self-edit approved/live campaigns or must create a revision;
- final support model;
- exact analytics privacy thresholds for small cohorts.

Keep these open until explicitly decided.