# Smart Shopper Promos — Shopper Experience North Star

## Status

- Component: shopper-facing Promos experience
- Parent feature: Promos Marketplace
- Development branch: `feature/promos-marketplace`
- Document type: living specification
- Related North Stars:
  - `ADVERTISER-NORTH-STAR.md`
  - `COMMAND-CENTER-NORTH-STAR.md`
- Shared map: `NORTH-STARS.md`

## 1. Purpose

The shopper-facing Promos experience should make advertising feel useful, relevant, controllable, and clearly sponsored rather than intrusive.

Promos must fit naturally inside Smart Shopper's existing role as a shopping and household decision app.

The experience must never become a generic banner-ad wall.

## 2. North Star outcome

A shopper should be able to:

- encounter promotions that are plausibly relevant to current or long-term interests;
- understand that a promotion is paid content;
- open it without immediately leaving Smart Shopper;
- like it;
- save it;
- share it;
- claim it where supported;
- add advertised products to a shopping list where supported;
- hide it;
- say `Not interested`;
- report it;
- understand why it was shown;
- browse categories intentionally rather than relying only on algorithmic ranking;
- maintain control over explicit interests and personalization settings.

## 3. Primary shopper surfaces

### 3.1 Home Promo Spotlight

The Home screen should contain a prominent but controlled Promo Spotlight section.

Recommended mobile characteristics:
- nearly full available width;
- responsive height around 130–160dp as a starting design range;
- one primary promotion visible at a time initially;
- clear `Sponsored` or `Promoted` label;
- premium visual treatment that still fits Smart Shopper;
- support advertiser-provided artwork or Smart Shopper-generated creative;
- advertiser identity;
- headline/offer;
- valid dates where relevant;
- primary CTA;
- Like, Save and Share glyphs;
- overflow actions for negative feedback and transparency.

The Home Spotlight must not dominate the Home experience.

### 3.2 Promos tab / feed

The Promos tab is a shopper discovery surface first.

It should contain:
- `For You`;
- categories/industries;
- saved promotions entry point;
- search where appropriate;
- featured/general campaigns;
- campaign cards;
- an `Advertise on Smart Shopper` entry point that moves advertisers into the advertiser journey without turning the shopper feed into an advertiser form.

### 3.3 Promo Detail

Opening an ad should normally open a Smart Shopper detail view first.

The detail view may contain:
- creative/artwork;
- advertiser/promoter identity;
- verified badge where applicable;
- offer headline;
- full description;
- valid dates/time windows;
- locations/service area;
- terms and exclusions;
- item/service tags;
- CTA actions such as website, WhatsApp, call, directions or promo code;
- Like;
- Save;
- Share;
- Claim Offer;
- Add to List where supported;
- Report;
- `Why am I seeing this?`;
- related promotions where appropriate.

## 4. Category and interest model

Businesses/advertisers must advertise under structured industries/categories, and shoppers must be able to browse or select interests using the same governed taxonomy.

The taxonomy should support concepts such as:
- Grocery;
- Food & Dining;
- Cooking;
- Technology;
- Automotive;
- Home;
- Fashion;
- Beauty;
- Education;
- Travel;
- Fitness;
- Family activities;
- Events;
- Services;
- Community;
- other governed categories.

The Command Center owns taxonomy governance and versioning.

A user can have many interests at the same time.

The system must not reduce a person to one dominant identity.

## 5. Relevance and recommendation model

### 5.1 V1 does not require heavy machine learning

Initial ranking can combine explicit rules and weighted signals.

Suggested signal classes:
- explicit interests chosen by the user;
- current shopping-list matches;
- current category/page context;
- recent non-sensitive shopping intent;
- longer-term non-sensitive interests;
- location context where permitted;
- time/day context;
- advertiser/category relevance;
- campaign freshness;
- creative/campaign quality;
- user negative feedback;
- frequency/fatigue;
- discovery/exploration.

A conceptual score may use:

`list match + explicit interest + recent intent + long-term interest + contextual fit + location + freshness + quality + discovery - fatigue - negative feedback`

Exact weights must be versioned and testable.

### 5.2 Recent intent and long-term affinity are separate

If a user temporarily shops heavily for college supplies, the system may increase education/college relevance for a period without deciding that this is the user's permanent identity.

Interest weights should decay appropriately when behavior changes.

### 5.3 Exploration is intentional

The feed should not become a closed loop that only repeats known interests.

A limited proportion of eligible impressions should support adjacent interests or broad discovery/general campaigns.

The exact proportion is a tunable system parameter, not a hardcoded permanent percentage.

### 5.4 Sensitive traits

Smart Shopper must not infer or target advertising based on sensitive traits such as:
- religion;
- race/ethnicity;
- health conditions;
- political affiliation;
- sexual orientation;
- other legally or ethically sensitive characteristics.

Users may explicitly opt into neutral content categories such as `Community Events` or `Faith & Community Events` where product policy permits, but the system must not infer a religious identity from unrelated behavior.

## 6. User controls

### 6.1 Like

Meaning:
- positive relevance/interest signal;
- lighter intent than Save.

Effect:
- can influence future non-sensitive relevance;
- contributes to advertiser aggregate analytics.

### 6.2 Save

Meaning:
- stronger intent;
- user may return later.

Effect:
- Saved Promos collection;
- optional expiry reminder;
- stronger recommendation signal than Like;
- advertiser aggregate analytics.

### 6.3 Share

Meaning:
- social/distribution signal;
- strong indication that creative/offer has value beyond passive viewing.

Effect:
- share sheet / platform-appropriate share mechanism;
- aggregate advertiser analytics;
- should not expose private Smart Shopper context in the shared payload.

### 6.4 Claim Offer

Where supported, a shopper may claim an offer.

Potential claim outputs:
- promo code;
- QR code;
- saved coupon;
- reservation/reference token;
- merchant redemption flow.

This creates a stronger conversion signal than impressions or clicks.

### 6.5 Add to List

Where the campaign contains structured products, Smart Shopper should eventually allow advertised products to be added to the user's shopping list.

This is strategically valuable because it connects advertising to shopping intent without exposing the underlying list to the advertiser.

### 6.6 Hide / Not Interested

The user should be able to:
- hide a single promotion;
- say `Not interested`;
- optionally choose `See fewer like this`;
- optionally hide an advertiser.

These are strong negative ranking signals.

### 6.7 Report

A shopper can report a promotion for policy/safety reasons.

Reporting should feed the Command Center moderation/trust workflow.

## 7. Views and shopper analytics events

The shopper experience must distinguish different exposure events.

### 7.1 Impression

The ad was rendered/displayed in an eligible surface.

### 7.2 Viewable impression

Enough of the creative was visible for a minimum duration.

Initial industry-style baseline to evaluate:
- at least 50% of the creative visible;
- for at least 1 continuous second.

The exact definition must be documented and consistent.

### 7.3 Promo open / detail view

The shopper actively opens the promotion detail.

### 7.4 Unique reach

Distinct eligible shoppers exposed during the selected reporting period.

Advertisers receive counts, not identities.

### 7.5 Repeat exposure / frequency

Track how often the same shopper is exposed so Smart Shopper can manage ad fatigue.

### 7.6 Engagement events

Track at minimum:
- like;
- unlike where relevant;
- save;
- unsave;
- share initiation/success where measurable;
- CTA click;
- claim;
- redemption where supported;
- add-to-list;
- hide;
- not interested;
- report.

## 8. Advertiser privacy boundary

Advertisers may receive aggregate analytics such as:
- impressions;
- viewable impressions;
- unique reach;
- opens;
- likes;
- saves;
- shares;
- CTA actions;
- claims;
- redemptions;
- engagement rate;
- broad allowed category/region/time performance.

Advertisers must not receive:
- individual shopper identity;
- individual shopping lists;
- private inferred interest profiles;
- sensitive attributes;
- raw private behavior histories.

## 9. `Why am I seeing this?`

For personalized promotions, the user should be able to see a plain-language explanation.

Examples:
- `You follow Technology promotions.`
- `This promotion matches items/categories in your current shopping activity.`
- `This is a general promotion available to shoppers in your region.`
- `This is a discovery promotion shown outside your usual interests.`

Do not expose internal model scores or private data unnecessarily.

## 10. General/admin campaigns

The Command Center may create or authorize general campaigns intended for broad audiences.

Targeting modes may include:
- personalized;
- category targeted;
- geographic;
- broad audience;
- platform-wide.

Terms/policy should disclose that some general sponsored content may appear even if it falls outside a user's selected interests, subject to personalization controls and applicable requirements.

Admin override must not mean arbitrary preference disregard without rules, audit history, or frequency controls.

## 11. Saved Promos

Saved promotions should have a dedicated collection.

Potential capabilities:
- sorted by expiry;
- active/expired state;
- expiry reminders;
- remove from saved;
- claim/redeem state;
- add associated items to list;
- advertiser/offer details.

## 12. Visual design direction

The shopper Promos experience should remain consistent with Smart Shopper's consumer design system.

Promotions may be visually richer than standard utility cards, but should not make the app feel chaotic.

### Core principles
- strong hierarchy;
- generous spacing;
- clear sponsored labels;
- premium artwork;
- controlled motion;
- accessible text contrast;
- responsive layouts;
- predictable placement of Like/Save/Share controls;
- no nested-border clutter;
- no unnecessary decorative chrome.

## 13. Motion and interaction

Motion should make state changes understandable, not distract.

Appropriate uses:
- subtle Like/Save acknowledgement;
- smooth category/filter changes;
- Promo Detail transition;
- lightweight card loading/entry;
- claim confirmation;
- saved state confirmation.

Avoid:
- excessive bouncing;
- motion that delays actions;
- animations that make browsing feel unstable.

Respect reduced-motion preferences.

## 14. Accessibility

At minimum:
- tappable controls at appropriate touch sizes;
- screen-reader labels for glyph-only actions;
- color never used as the sole state indicator;
- readable sponsored labeling;
- accessible contrast;
- keyboard/focus support on web surfaces;
- reduced-motion behavior.

## 15. Shopper trust rules

### Paid versus organic

A paid campaign cannot masquerade as an impartial Smart Shopper recommendation.

`Sponsored`/`Promoted` labeling is mandatory on paid placements.

### Best-price claims

An advertiser paying for placement does not automatically become `Best Deal`, `Cheapest`, or another organic ranking claim.

Those labels require separate Smart Shopper evidence.

### Deceptive design

Do not hide sponsorship disclosure, force accidental taps, or make close/report controls difficult to use.

## 16. Performance/frequency protection

The shopper experience must protect against overexposure.

Future controls may include:
- max impressions per shopper/session/day;
- creative fatigue limits;
- advertiser frequency caps;
- surface-specific caps;
- suppression after hide/not-interested;
- suppression after redemption where appropriate.

The Command Center owns the tunable controls; this North Star defines the shopper requirement.

## 17. Relationship to the advertiser experience

The shopper-facing creative is the final result of advertiser inputs and Smart Shopper rendering.

Advertisers must be able to preview the actual shopper surfaces before submission.

Creative dimensions and safe areas should derive from real shopper components, not arbitrary ad sizes.

## 18. Relationship to the Command Center

The Command Center may manage:
- taxonomy;
- eligible placements;
- general campaigns;
- experience-module configuration;
- style variants exposed by engineering;
- frequency caps;
- fallback behavior;
- feature flags;
- trust/safety decisions.

It must not inject arbitrary executable code into the shopper app.

## 19. V1 acceptance direction

A credible V1 shopper experience should demonstrate:
- real Home Spotlight component;
- Promos feed;
- category browsing;
- Promo Detail;
- Like;
- Save;
- Share;
- Hide/Not Interested;
- Report;
- Saved Promos;
- clear Sponsored labeling;
- explainable `Why am I seeing this?` behavior;
- analytics event plumbing for impression/viewable impression/open/engagement;
- responsive mobile design;
- feature-flagged rollout.

## 20. Open questions that must not be guessed

- exact Home Spotlight dimensions after real device testing;
- final category taxonomy;
- exact viewability threshold;
- final personalization settings language;
- exact exploration/general campaign ratio;
- notification cadence for saved-promo reminders;
- redemption mechanism and merchant verification model;
- final limits on frequency/ad load;
- exact web versus native Promo Detail behavior.

Open questions should remain explicit until decided.