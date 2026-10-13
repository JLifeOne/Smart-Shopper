# Smart Shopper Promos Marketplace - Product and Engineering North Star

## Status

- Feature: Promos Marketplace
- Repository: `JLifeOne/Smart-Shopper`
- Development branch: `feature/promos-marketplace`
- Main branch policy: do not implement or merge this feature directly on `main`. Continue development, testing, documentation, and preview work on the feature branch until an explicit merge instruction is given.
- Current product state: Smart Shopper already has a Promos tab route and a Home `Promos spotlight` placeholder. This feature replaces the placeholder with a complete shopper, advertiser, admin, payment, moderation, analytics, and recommendation system.

## 1. North Star

Smart Shopper Promos should become a privacy-respecting marketplace that connects shoppers with useful promotions at the moment they are most relevant, while giving advertisers measurable value and giving Smart Shopper a sustainable revenue stream.

The system must not behave like an intrusive generic banner network. It should behave like an intelligent promotions layer inside a shopping and household decision app.

The North Star experience is:

1. A shopper sees promotions that are useful because they match explicit interests, current shopping intent, recent behavior, long-term non-sensitive interests, location context when permitted, and discovery needs.
2. A shopper can like, save, share, hide, report, open, claim, or act on a promotion without being forced out of Smart Shopper unless the chosen action requires an external destination.
3. An advertiser can create, pay for, submit, reuse, schedule, and improve campaigns in one streamlined workflow.
4. A Premium membership may include advertising entitlements, but advertising is not limited to Premium members. Any eligible advertiser can pay directly for an individual campaign.
5. Payment is collected at campaign submission. The campaign then enters moderation. Minor corrections do not unwind the purchase. Genuine policy rejection may trigger refund or restoration of Promo Credits.
6. Advertisers receive aggregated performance analytics and optimization guidance without receiving a shopper's identity, shopping list, private interest profile, or other private user data.
7. Smart Shopper learns what each shopper tends to find useful, but the system must not infer or target sensitive traits such as religion, race, health conditions, sexual orientation, political affiliation, or other sensitive characteristics.
8. Admin has strong moderation, finance, inventory, customer support, audit, safety, and kill-switch controls.
9. The feature is built incrementally, defensively, and observably on a branch, with preview testing before merge.

## 2. Product principles

### 2.1 Useful before profitable

Revenue matters, but ad load must never make Smart Shopper feel like an ad container. Promotions must improve the shopper's experience or at least avoid degrading it.

### 2.2 User control is a product feature

Users should be able to explicitly choose interests, remove interests, see categories directly, hide promotions, say `Not interested`, report inappropriate ads, manage personalization, and understand in plain language why a promotion may have been shown.

### 2.3 Relevance must be multi-dimensional

A person must never be reduced to one identity or one recent behavior. A user can simultaneously be interested in food, technology, automotive, travel, education, home goods, church/community events, sports, and other topics. The system should maintain multiple weighted interests and separate long-term affinity from short-term intent.

### 2.4 Privacy by design

Advertisers buy access to eligible audiences, not access to private user data. Matching happens inside Smart Shopper.

### 2.5 Clear separation of paid promotion and organic intelligence

A paid promotion must be labeled clearly as `Promoted` or `Sponsored`. Paid placement must not be presented as though Smart Shopper independently determined that the advertiser is the cheapest or best option unless that claim is separately supported by Smart Shopper data.

### 2.6 Human authority over consequential actions

Machine learning and AI may assist targeting, ranking, creative suggestions, campaign analysis, and optimization recommendations. They must not silently change an advertiser's budget, creative, targeting, schedule, or campaign duration. The advertiser approves material campaign changes. Admin retains moderation authority.

### 2.7 Build for reversibility

Every major release must have feature flags, rollback paths, audit trails, and safe defaults.

## 3. Users and roles

### 3.1 Shopper

A normal Smart Shopper user consuming promotions.

Capabilities may include:
- view Home Promo Spotlight;
- browse Promos Feed;
- browse by category/industry;
- search advertisers and promotions;
- select interests;
- like a promotion;
- save a promotion;
- share a promotion;
- open promo detail;
- claim an offer when supported;
- use CTA actions such as WhatsApp, call, directions, website, promo code, or add item to shopping list;
- follow an advertiser or brand in a later phase;
- hide or mark `Not interested`;
- report a promotion;
- manage ad personalization preferences;
- see saved promotions and expiry reminders;
- see `Why am I seeing this?` for personalized recommendations.

### 3.2 Advertiser / Promoter

Any eligible person or organization advertising through Smart Shopper. This is intentionally broader than `business`.

Supported advertiser types should include:
- registered business;
- sole trader / solopreneur;
- individual seller;
- church / faith organization;
- nonprofit / community group;
- event organizer;
- restaurant;
- supermarket / retailer;
- service provider;
- online seller;
- school / education provider;
- verified brand;
- other policy-compliant promoter types.

An advertiser does not have to be a Premium subscriber. They may pay per campaign.

### 3.3 Admin / Moderator

Authorized Smart Shopper staff responsible for review, safety, scheduling, policy enforcement, refunds, support, and campaign operations.

### 3.4 Finance / Support role

Recommended separate permissions for staff who can view payments, process authorized refunds, handle disputes, or assist advertisers without automatically gaining full moderation or super-admin power.

### 3.5 Super Admin

Highest privilege role for role management, system-wide kill switches, category policy, billing configuration, sensitive audit review, and emergency actions. This role must be limited and protected with strong authentication.

## 4. Shopper experience

### 4.1 Home Promo Spotlight

The Home screen receives a full-width Promo Spotlight area, approximately 130-160dp high on mobile with responsive sizing rather than physical-inch assumptions.

The card should support:
- artwork / hero image;
- generated creative when no artwork is supplied;
- advertiser name;
- concise offer headline;
- promotion period;
- optional location indicator;
- `Promoted` or `Sponsored` label;
- like glyph;
- save glyph;
- share glyph;
- overflow menu for `Not interested`, `See fewer like this`, `Report ad`, and `Why am I seeing this?`;
- primary CTA.

The Home Spotlight should not monopolize Home. One primary promo surface is preferred initially.

### 4.2 Promo detail screen

Tapping a promo opens an in-app detail view before sending the user elsewhere.

The detail screen may contain:
- full artwork;
- advertiser name and optional verified badge;
- headline;
- detailed offer copy;
- valid dates and time conditions;
- eligible locations / service area;
- terms and exclusions;
- item or service tags;
- promo code where applicable;
- directions;
- call;
- WhatsApp;
- website;
- add advertised item to a Smart Shopper list where relevant;
- save;
- like;
- share;
- claim offer;
- report;
- related promotions.

### 4.3 Promos Feed

The Promos tab is primarily a consumer discovery experience, not only an advertiser form.

Recommended top navigation:
- For You
- Grocery
- Food & Dining
- Tech
- Home
- Auto
- Fashion
- Beauty
- Health & Wellness where permitted
- Education
- Events
- Travel
- Services
- Community
- More

The exact taxonomy must be admin-managed and versioned.

The screen also contains a prominent `Advertise on Smart Shopper` entry point.

### 4.4 Interests and preferences

Users should be able to explicitly select multiple interests.

Examples:
- Grocery
- Restaurants
- Cooking
- Technology
- Automotive
- Home improvement
- Education
- Travel
- Fitness
- Family activities
- Community events
- Entertainment

A user can follow many categories at the same time.

The system should distinguish:
- explicit interests chosen by the user;
- long-term inferred non-sensitive interests;
- short-term recent intent;
- active shopping-list intent;
- contextual signals such as time, broad region, or current category being viewed;
- discovery / exploration candidates.

### 4.5 Like, Save, Share, Hide, Report

These signals have different meanings and should not be treated equally.

Recommended interpretation:
- impression: weak exposure signal;
- detail open: mild interest;
- like: positive relevance signal;
- save: strong future-intent signal;
- share: strong usefulness / advocacy signal;
- CTA click: strong action signal;
- claim: very strong intent signal;
- add advertised item to list: very strong shopping-intent signal;
- hide / not interested: strong negative signal;
- report: safety signal, not merely ranking feedback.

### 4.6 Saved Promos

Recommended additional shopper surface:
- saved promotions list;
- filters for active / expiring / expired;
- optional reminder before expiry;
- remove saved promo;
- one-tap CTA;
- claimed offers section.

### 4.7 Sharing

Sharing should generate a campaign-aware deep link rather than only sharing a screenshot.

Share destinations may include:
- system share sheet;
- WhatsApp;
- Messages;
- social apps;
- copy link;
- QR code in later phase.

Shared-link events should be tracked in aggregate for advertiser analytics.

### 4.8 Claimable offers and redemption

Recommended extension for stronger real-world conversion measurement:
- `Claim Offer` creates a saved claim in Smart Shopper;
- claim may expose a promo code, QR code, or redemption token;
- advertiser can optionally mark codes as redeemed through a merchant interface or integration;
- users can add claim to Saved Promos;
- expiry is visible;
- reminder can be sent before expiration if the user opts in.

This allows Smart Shopper to measure more than clicks and gives advertisers stronger proof of business value.

## 5. Advertiser experience

### 5.1 Advertiser dashboard

Once a user advertises, they receive a personalized advertiser dashboard.

Recommended navigation:
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
- Promo Credits / Plan
- Billing
- Analytics
- Recommendations
- Account / Verification
- Support

### 5.2 Create Campaign flow

The campaign flow must be a single guided funnel.

#### Step 1: Campaign objective

Examples:
- drive store visits;
- promote sale;
- promote event;
- generate calls;
- generate WhatsApp messages;
- drive website visits;
- promote new product;
- increase awareness;
- get offer claims;
- other.

Objective helps Smart Shopper recommend CTA, placement, and analytics.

#### Step 2: Advertiser identity

Capture:
- display name;
- advertiser type;
- contact details;
- optional logo;
- optional verification details;
- website / social presence where applicable.

Verification is not mandatory for all advertisers, but verified businesses or organizations may receive a visible badge.

#### Step 3: Industry and campaign categories

Advertiser selects:
- primary industry;
- campaign category;
- product / service topic tags;
- optional brands / items represented.

Example:
- Industry: Retail
- Category: Grocery
- Topics: Chicken, rice, detergent

This structured classification is fundamental to targeting and analytics.

#### Step 4: Creative

Creative upload is optional.

Advertiser may:
- upload artwork;
- upload product photo;
- upload logo;
- use Smart Shopper's standardized promo-card builder;
- eventually request AI-assisted creative suggestions.

The app should define safe asset limits, dimensions, aspect ratios, file types, compression, and maximum sizes.

If there is uncertainty about visual design during development, the implementation team should create an AI-assisted visual mockup first, obtain design approval, document the accepted reference, and then map the UI to that approved design rather than improvising directly in production code.

#### Step 5: Copy and offer

Capture:
- headline;
- supporting text;
- discount / benefit where applicable;
- start date;
- end date;
- terms;
- location / service area;
- promo code;
- CTA.

#### Step 6: Targeting

Initial targeting controls should remain understandable.

Potential inputs:
- industry / category;
- broad geography;
- relevant interest categories;
- list-item matching where eligible;
- time / day;
- placement;
- campaign objective.

Advertisers must never be given the ability to target sensitive inferred characteristics.

#### Step 7: Placement and schedule

Potential inventory:
- Promos Feed;
- Home Spotlight;
- Featured Promo Feed placement;
- category spotlight;
- saved-promo reminder sponsorship in later phase where appropriate.

Schedule choices may include:
- number of campaign days;
- all day;
- morning;
- midday;
- evening;
- weekend;
- specified time windows;
- scheduled start date.

Time-slot inventory must be capacity controlled to prevent overselling.

#### Step 8: Membership entitlement and pricing

Advertising is hybrid monetization.

Free / non-Premium user:
- can pay per campaign.

Premium user:
- may receive Promo Days, placement allowances, time-slot benefits, or campaign credits as part of plan;
- may pay for usage beyond plan allowance;
- may combine included entitlements and paid overage in one checkout.

No plan should initially offer uncontrolled unlimited advertising.

Example calculation:
- campaign requires 7 Promo Days;
- user has 4 eligible Promo Days;
- 4 days covered by plan;
- 3 days charged at current campaign rate.

Exact prices and plan allowances are not locked in this document and must be configurable rather than hard-coded.

#### Step 9: Preview

Advertiser sees realistic previews for:
- Home Spotlight;
- Promos Feed;
- Promo detail page;
- major mobile breakpoints;
- web / PWA if applicable.

#### Step 10: Policy acknowledgment and payment

The user accepts:
- Advertising Policy;
- prohibited-content rules;
- refund rules;
- payment terms;
- moderation terms;
- campaign timing rules;
- privacy rules.

Payment or entitlement consumption occurs as part of submission.

#### Step 11: Submit for review

After successful payment / entitlement reservation:
- payment status becomes paid or entitlement-reserved;
- moderation status becomes under review;
- inventory is reserved according to scheduling rules;
- advertiser receives confirmation.

### 5.3 Campaign reuse

Every eligible completed or previous campaign should have `Reuse Campaign`.

Reuse creates a new draft containing:
- creative;
- copy;
- category;
- tags;
- CTA;
- targeting;
- placement;
- previous schedule structure.

The new campaign receives a new campaign ID. Historical analytics remain attached to the original campaign and are never merged accidentally.

### 5.4 AI / algorithmic advertiser assistance

The system should help advertisers improve outcomes while remaining transparent.

Potential recommendations:
- strongest engagement time of day;
- better category selection;
- better CTA based on objective;
- creative has high opens but weak CTA clicks;
- campaign performs strongly with certain non-sensitive interest categories;
- current duration may be too short to reach desired audience;
- ad fatigue detected;
- reuse top-performing creative;
- extend successful campaign;
- try a broader or narrower region;
- campaign category is mismatched to creative;
- offer needs clearer pricing or expiry information.

The algorithm may suggest. It must not silently modify live campaign scope or spend.

## 6. Advertiser analytics

### 6.1 Core funnel

Present campaign performance as:

Reach -> Interest -> Intent -> Action

Recommended metrics:
- impressions;
- viewable impressions;
- unique reach;
- frequency;
- detail opens;
- likes;
- saves;
- shares;
- claims;
- CTA clicks;
- WhatsApp clicks;
- call clicks;
- directions clicks;
- website clicks;
- add-to-list actions;
- promo-code reveals;
- redemptions where supported;
- hide / not-interested rate;
- report rate;
- engagement rate;
- save rate;
- click-through rate;
- claim rate;
- estimated cost per engagement;
- cost per claim where applicable;
- performance by date/time;
- performance by placement;
- performance by broad region;
- performance by approved non-sensitive category segment.

### 6.2 Viewable impression definition

For consistent analytics, define an impression rule rather than incrementing whenever data is fetched.

Initial recommended rule for mobile/web prototype:
- count a viewable impression when at least 50% of the promo card is visible for at least 1 continuous second;
- deduplicate repeated rapid exposure within a session according to a documented window;
- maintain separate total impressions and unique reach.

This value can be revisited after real performance testing.

### 6.3 Privacy thresholds

Advertisers receive aggregated analytics only.

Do not expose granular audience breakdowns when a segment is too small. Establish a configurable minimum cohort threshold to reduce re-identification risk.

Never expose:
- a user's shopping list;
- exact user identity;
- exact household behavior;
- private interest vectors;
- sensitive inferences;
- exact device location;
- another advertiser's private campaign data.

### 6.4 Fraud / invalid traffic

Build defenses for:
- advertiser self-clicking;
- bot traffic;
- rapid repetitive clicks;
- scripted likes/saves;
- fake accounts;
- unusual geographic bursts;
- repeated device abuse;
- click farms;
- malicious referral patterns.

Analytics should distinguish raw events from validated billable / reportable events where necessary.

## 7. Recommendation and personalization system

### 7.1 Do not begin with heavy ML

Version 1 should be deterministic and explainable using category and score-based ranking.

Inputs:
- explicit user interests;
- current shopping-list matches;
- recent non-sensitive browsing / engagement;
- long-term non-sensitive interest weights;
- saved promotions;
- liked promotions;
- shared promotions;
- negative feedback;
- broad location when permission and policy allow;
- time/day relevance;
- advertiser campaign targeting;
- freshness;
- frequency caps;
- exploration allocation;
- campaign quality / trust score.

Later phases can introduce learned ranking after there is enough real interaction data to train and validate responsibly.

### 7.2 Multiple interest vectors

A user should have multiple weighted interests rather than a single persona.

Maintain at least:
- explicit interest score;
- long-term behavioral score;
- recent intent score;
- active list-intent score.

Recent intent should decay over time so a temporary focus does not become a permanent identity.

### 7.3 Candidate generation

Candidate campaigns must first satisfy hard eligibility:
- live;
- within schedule;
- not expired;
- region eligible;
- placement eligible;
- advertiser not blocked;
- campaign policy valid;
- inventory / pacing valid;
- user has not hidden advertiser or campaign where applicable;
- age / safety restrictions satisfied.

### 7.4 Ranking

Initial conceptual score:

`score = list_match + explicit_interest + recent_interest + long_term_interest + contextual_fit + location_fit + freshness + quality + exploration - fatigue - negative_feedback`

Actual weights must be versioned and tested, not embedded as unexplained magic numbers.

### 7.5 Diversity and exploration

Do not show only what the user already knows.

The ranking system should reserve controlled inventory for:
- adjacent interests;
- new advertisers;
- general promotions;
- discovery campaigns.

This prevents a filter bubble and gives new advertisers a reasonable opportunity to be discovered.

### 7.6 Frequency caps and ad fatigue

A campaign should not repeatedly dominate a user's Home screen.

Implement:
- per-user campaign frequency caps;
- per-advertiser frequency caps;
- repeated-exposure decay;
- creative rotation when advertiser supplies variants.

### 7.7 Negative signals

`Not interested`, `See fewer like this`, repeated ignores, hides, and reports should reduce future ranking. Reports also enter safety workflows.

### 7.8 Sensitive data prohibition

Do not infer or personalize advertising based on sensitive characteristics such as:
- religion;
- race / ethnicity;
- health condition;
- disability;
- political affiliation;
- sexual orientation;
- sex life;
- criminal history;
- trade union membership;
- severe financial hardship;
- other legally or ethically sensitive attributes.

Example: a church promotion may be browsed through an explicit `Community / Faith Events` category selected by a user, but Smart Shopper should not infer that a user is Christian and build a hidden religious profile from behavior.

### 7.9 Minors / unknown age

Until policy is finalized, personalized advertising for known minors should be disabled. If age eligibility cannot be established, use conservative contextual targeting for restricted categories.

### 7.10 Why am I seeing this?

Recommended transparency panel:
- `You selected Technology as an interest.`
- `This promotion matches items on a current list.`
- `This advertiser is promoting broadly in your region.`
- `This is a general Smart Shopper promotion.`

Never expose sensitive inference in this panel because sensitive inference must not exist.

## 8. General / admin override campaigns

Admin may designate campaigns as broad or platform-wide when appropriate.

Examples:
- major general retail promotion;
- Smart Shopper announcement;
- public-service notice;
- major national event;
- broad advertiser campaign.

This capability must not become unlimited preference bypass.

Requirements:
- campaign clearly labeled;
- frequency capped;
- reason / campaign type recorded;
- terms explain that users may occasionally receive broad sponsored content outside selected interests;
- sensitive targeting rules still apply;
- admin action is audited.

## 9. Payment, entitlement, reservation, and refund model

### 9.1 Core rule

Payment occurs during submission, before moderation is completed.

Reason: avoid forcing approved advertisers to return later to complete a second checkout, which creates unnecessary friction and abandonment.

### 9.2 Separate state machines

Do not collapse payment, moderation, and campaign status into one field.

#### Payment status
- pending
- authorized if provider supports it
- paid
- partially_refunded
- refunded
- failed
- disputed / chargeback where applicable

#### Moderation status
- draft
- submitted
- under_review
- changes_requested
- approved
- rejected
- appealed where implemented

#### Campaign delivery status
- awaiting_moderation
- reserved
- scheduled
- live
- paused
- completed
- cancelled
- expired

### 9.3 Changes requested

A reasonable correction does not trigger refund.

Examples:
- headline clarification;
- illegible artwork;
- missing promotion dates;
- CTA correction;
- unsupported claim requiring evidence or wording change.

Campaign remains paid/reserved while changes are addressed within a defined response window.

### 9.4 Policy rejection

Examples may include prohibited sexual content, fraud, malicious links, illegal goods/services, or other explicitly prohibited content.

A rejected campaign should follow the documented refund policy. The policy must state what is refundable, what fees if any are non-refundable, and what happens after chargeback or repeated abuse.

### 9.5 Entitlement restoration

If Premium Promo Days / credits were consumed for a campaign that is fully rejected and eligible for refund, those credits should be restored according to policy.

### 9.6 Idempotency

All payment creation, webhook, entitlement consumption, refund, and campaign-submission writes must be idempotent and safe to replay.

### 9.7 Inventory reservation

When the advertiser pays for a scarce placement or time slot, reserve that inventory while moderation occurs.

Requirements:
- transactional reservation;
- expiration / release policy;
- no double-selling;
- changes-requested grace period;
- automatic release on qualified cancellation / refund;
- admin visibility into inventory calendar.

## 10. Premium plans and Promo Credits

Premium is one funding path, not the only path.

Recommended entitlement model:
- `Promo Days` or campaign credits;
- placement eligibility;
- featured-slot allowances;
- time-slot allowances;
- analytics tier;
- optional verification benefits;
- overage purchase.

Do not hard-code plan names or numbers into campaign logic.

Create an entitlement ledger with:
- source;
- amount granted;
- amount consumed;
- placement restrictions;
- valid_from;
- expires_at;
- campaign consumption references;
- restoration entries;
- admin adjustment entries;
- immutable financial/audit trail.

## 11. Campaign inventory and pacing

Campaign delivery should not simply query all active ads and randomize them.

Build an inventory service that considers:
- placement capacity;
- time-slot capacity;
- campaign start/end;
- priority level;
- user frequency caps;
- advertiser frequency caps;
- pacing against purchased duration / impressions if impression products are added later;
- fairness;
- reservation state;
- emergency pause.

Initial monetization should remain simple: placement + duration + time window + geography + plan benefit.

Do not introduce auction bidding until there is enough demand to justify the complexity.

## 12. Admin console

Admin should be a dedicated secure web experience, not hidden inside the consumer navigation.

### 12.1 Dashboard overview

Recommended widgets:
- new submissions;
- oldest unreviewed submission;
- changes requested;
- awaiting advertiser response;
- paid under review;
- scheduled campaigns;
- live campaigns;
- campaigns expiring today;
- campaigns paused;
- reported ads;
- refund queue;
- chargebacks;
- revenue today / week / month;
- Promo Credit consumption;
- fill rate by placement;
- current inventory by time slot;
- moderation SLA;
- system health / delivery errors.

### 12.2 Review queue

Each submission should show:
- campaign preview;
- advertiser details;
- advertiser verification state;
- payment state;
- campaign classification;
- requested targeting;
- schedule;
- placement;
- policy flags;
- previous advertiser violations;
- automated content-safety hints;
- links / CTA destinations;
- moderator notes.

Admin actions:
- approve;
- request changes;
- reject;
- edit with explicit audit record;
- assign reviewer;
- escalate;
- schedule;
- publish;
- pause;
- end campaign;
- initiate authorized refund;
- restore credits;
- suspend advertiser where policy allows.

### 12.3 Moderation reason codes

Use structured reasons plus human notes.

Examples:
- misleading claim;
- prohibited content;
- unsupported product category;
- unsafe link;
- incomplete dates;
- artwork quality;
- copyright / impersonation concern;
- wrong category;
- pricing mismatch;
- duplicate campaign;
- spam;
- other.

Structured reasons improve analytics and consistency.

### 12.4 Reports and safety queue

User reports should enter an admin queue with:
- campaign;
- report reason;
- timestamp;
- report volume;
- severity;
- campaign status;
- prior reports;
- automated anomaly indicators.

Admin should be able to pause a campaign immediately while reviewing severe reports.

### 12.5 Inventory calendar

Admin needs a calendar/timeline showing:
- Home Spotlight availability;
- featured slots;
- time windows;
- reserved campaigns;
- paid campaigns pending review;
- scheduled campaigns;
- conflicts;
- capacity warnings.

### 12.6 Finance tools

Recommended:
- payments list;
- campaign-to-payment reconciliation;
- Promo Credit ledger;
- refunds;
- partial refunds if policy later permits;
- disputes / chargebacks;
- payout / processor fees if applicable;
- failed-payment review;
- downloadable transaction reports;
- immutable audit trail.

### 12.7 Advertiser support

Admin/support should see:
- advertiser contact;
- campaign history;
- moderation history;
- billing history;
- open support issues;
- notes;
- verification status;
- warnings / strikes;
- refunds;
- credit adjustments.

Support users should not automatically have super-admin permission.

### 12.8 Taxonomy manager

Admin must be able to add, rename, merge, deprecate, or reorder industries, categories, topics, and restricted categories without app releases where practical.

Changes must be versioned because historical campaign analytics depend on old categories.

### 12.9 Policy manager

Recommended future tool:
- policy versions;
- effective date;
- prohibited categories;
- restricted categories;
- required advertiser acknowledgments;
- change log.

Existing campaigns may need re-review after material policy changes.

### 12.10 Global controls

Admin / Super Admin should have:
- pause all paid promos;
- pause one placement;
- pause one advertiser;
- disable personalized ranking while continuing contextual promos;
- switch to fallback promo feed;
- disable new campaign submission;
- disable payment creation;
- emergency banner / status notice.

Every global action requires audit logging.

## 13. Content and advertising policy

A formal Advertising Policy must exist before production payment acceptance.

At minimum define:
- prohibited sexual / pornographic material;
- illegal goods and services;
- fraud / scams;
- malware / malicious links;
- hate / harassment;
- impersonation;
- deceptive claims;
- counterfeit goods;
- dangerous or heavily regulated products;
- age-restricted categories;
- weapons policy;
- gambling policy;
- alcohol policy;
- tobacco / nicotine policy;
- political advertising policy;
- financial-services policy;
- healthcare claims policy;
- intellectual-property policy;
- child-safety policy;
- advertiser responsibility;
- refund / rejection rules;
- appeal process;
- repeated-violation consequences.

High-risk categories should default to disallowed until Smart Shopper has consciously designed the legal, age, verification, and moderation controls to support them.

## 14. Privacy and data protection

### 14.1 Core privacy promise

Private shopper data remains within Smart Shopper's systems and is not sold or exposed to advertisers as identifiable audience data.

### 14.2 Personalization preference center

Users should be able to:
- enable / disable personalized promos where required;
- choose explicit interests;
- remove interests;
- clear inferred non-sensitive promo interests where supported;
- disable location-based relevance;
- hide advertisers;
- review saved promos;
- understand why an ad was shown;
- access relevant privacy information.

### 14.3 Data minimization

Store only what is required for recommendation, fraud prevention, analytics, campaign delivery, legal obligations, and user-requested features.

### 14.4 Advertiser analytics privacy

Use aggregated reporting and cohort thresholds.

### 14.5 Automated decision safeguards

Because personalization involves automated ranking, document:
- signals used;
- prohibited signals;
- user controls;
- fallback behavior;
- ability to disable personalization;
- model / scoring version;
- audit / evaluation process.

### 14.6 Platform and legal review

Before production launch, privacy and advertising behavior must be checked against current applicable law and platform rules in each launch market. In Jamaica, the Data Protection Act includes provisions covering consent to direct marketing and rights related to automated decision-taking. Mobile-store rules may impose additional requirements, particularly if third-party tracking or cross-app data is introduced.

Smart Shopper should avoid third-party ad-network tracking by default. First-party contextual and first-party personalized ranking inside Smart Shopper is the preferred architecture.

## 15. Suggested data model

Exact names may change after schema review, but responsibilities should remain separated.

### 15.1 `advertiser_profiles`
- id
- owner_user_id
- display_name
- advertiser_type
- verification_status
- logo_asset_id
- contact fields
- status
- created_at
- updated_at
- version

### 15.2 `promo_campaigns`
- id
- advertiser_id
- objective
- headline
- body
- primary_industry_id
- category_id
- moderation_status
- delivery_status
- start_at
- end_at
- timezone
- placement configuration
- broad region configuration
- CTA type / destination
- policy_version_accepted
- version
- created_at
- updated_at

### 15.3 `promo_campaign_topics`
Campaign-to-topic relation.

### 15.4 `promo_creatives`
- id
- campaign_id
- asset type
- storage path
- dimensions
- mime type
- moderation state
- active variant
- metadata

### 15.5 `promo_targeting_rules`
Stores campaign targeting rules without exposing individual user identities to advertisers.

### 15.6 `promo_inventory_reservations`
- campaign_id
- placement
- slot_start
- slot_end
- reservation_status
- expires_at
- payment reference
- unique constraint preventing double-sell.

### 15.7 `promo_payments`
- campaign_id
- provider
- provider transaction reference
- amount
- currency
- payment status
- idempotency key
- paid_at
- refund totals

### 15.8 `promo_refunds`
Immutable refund records.

### 15.9 `promo_entitlements`
Credits / Promo Days granted from subscriptions, purchases, promotions, or admin actions.

### 15.10 `promo_entitlement_ledger`
Append-only grants, consumption, expiration, restoration, and adjustments.

### 15.11 `promo_user_actions`
Privacy-conscious event table for:
- impression;
- open;
- like;
- save;
- share;
- hide;
- not_interested;
- claim;
- CTA;
- add_to_list;
- report.

Consider event aggregation / retention strategy before storing long-term raw event history.

### 15.12 `promo_saved_items`
User-to-campaign saved relationship.

### 15.13 `promo_claims`
Claimed offer / redemption metadata.

### 15.14 `promo_reports`
User safety reports.

### 15.15 `promo_moderation_actions`
Append-only moderation audit history.

### 15.16 `promo_admin_audit_log`
Append-only record of privileged actions.

### 15.17 `promo_taxonomy`
Versioned industries, categories, topics, policy restrictions.

### 15.18 `promo_daily_analytics`
Aggregated materialized campaign statistics for fast advertiser dashboard reads.

## 16. Backend and security architecture

Use the existing Smart Shopper architecture where practical:
- Supabase Auth;
- Postgres;
- RLS;
- Supabase Storage;
- Edge Functions;
- feature flags;
- structured logs;
- analytics events.

Requirements:
- no admin authorization based only on client UI;
- RLS and server-side role checks;
- signed URLs or controlled public asset strategy depending on creative visibility;
- rate limits for submission, likes, saves, shares, reports, and analytics events;
- Zod or equivalent validation at boundaries;
- correlation IDs for backend failures;
- idempotency for payment / entitlement writes;
- transactions for campaign submission + payment association + reservation;
- OCC/version fields for admin edits and advertiser revisions;
- audit logs for privileged actions;
- safe URL validation for advertiser CTA destinations;
- file type / file size / decompression-bomb protections for uploads;
- malware / unsafe URL review where possible;
- no secret values in logs.

## 17. Observability

Track technical health independently from campaign analytics.

Recommended engineering metrics:
- promo-feed fetch latency;
- promo-ranking latency;
- no-candidate rate;
- image-load failure rate;
- CTA dispatch failure rate;
- payment creation failures;
- webhook failures;
- duplicate webhook detections;
- inventory reservation conflicts;
- moderation queue age;
- event-ingestion errors;
- analytics aggregation lag;
- save/like write failure rate;
- report processing lag;
- refund failure rate;
- campaign status-transition failures.

Every backend error should include a safe correlation ID.

## 18. Append-only engineering history

This feature must maintain chronological logs.

Rules:
- do not delete prior failures;
- do not rewrite history to make an incident disappear;
- append new incident/fix entries;
- include date, environment, symptoms, root cause, fix, verification, commit/PR, and prevention added;
- if an old failure recurs, link back to the old entry and explain whether the prior guardrail failed or the new incident is materially different.

Feature-specific logs live under this directory.

## 19. Commenting and code-quality rule

Code must be properly commented where intent is not obvious.

Comments should explain:
- why logic exists;
- invariants;
- state transitions;
- security assumptions;
- retry / idempotency behavior;
- ranking rationale;
- edge cases;
- failure / fallback behavior.

Do not add noisy comments that merely repeat the code. The standard is clarity for the next engineer, not comment volume.

No shortcut patches, unexplained magic numbers, silent catches, client-only security gates, or temporary production bypasses.

## 20. Design workflow

Design must be deliberate.

For each major surface:
- Shopper Home Spotlight
- Promos Feed
- Promo Detail
- Interest Preferences
- Saved Promos
- Advertiser Dashboard
- Campaign Builder
- Campaign Preview
- Analytics Dashboard
- Admin Review Queue
- Admin Campaign Detail
- Inventory Calendar
- Admin Finance / Refund View

Process:
1. define required information and actions;
2. create wireframe / structured layout;
3. if visual direction is unclear or quality is not good enough, create AI-assisted image mockups before coding;
4. choose / approve visual direction;
5. document accepted reference;
6. implement on branch;
7. compare implementation against reference;
8. test responsive behavior and accessibility;
9. do not merge based on function alone if design quality is not acceptable.

## 21. Branch, preview, and merge policy

### 21.1 Branch rule

All Promos Marketplace work continues on:

`feature/promos-marketplace`

or child branches explicitly created for isolated sub-features and then merged back into the Promos feature branch.

Do not develop this feature directly on `main`.

### 21.2 Preview rule

Before `main` merge:
- run mobile/web locally;
- generate a testable branch preview;
- use Expo Web and, when the branch deployment path is configured, a Cloudflare Pages preview or equivalent isolated preview;
- test with realistic seed campaigns;
- test shopper, advertiser, and admin roles;
- test payment sandbox / entitlement flows;
- test moderation;
- test failure and recovery paths.

### 21.3 Merge rule

No merge to `main` until explicit instruction is given after successful testing and review.

Passing typecheck is not enough. The user journeys, visual design, security, data integrity, and rollback path must also be verified.

## 22. Delivery phases

### Phase 0 - Documentation and design

Deliver:
- North Star document;
- decision log;
- failure log;
- taxonomy proposal;
- advertising policy draft;
- data model review;
- shopper mockups;
- advertiser mockups;
- admin mockups;
- acceptance test matrix.

### Phase 1 - Interactive POC on branch

Goal: prove the end-to-end experience without prematurely hardening every backend dependency.

Include:
- Home Promo Spotlight;
- Promos Feed;
- like/save/share;
- Promo Detail;
- Advertise CTA;
- campaign builder;
- creative upload / generated placeholder card;
- pricing / plan-credit simulation;
- payment sandbox or explicit mock boundary;
- Under Review state;
- Admin Review Queue;
- Approve / Changes Requested / Reject;
- Publish;
- published promo appears on shopper surfaces;
- advertiser dashboard with seeded analytics;
- campaign reuse.

No production payment acceptance during POC.

### Phase 2 - Production schema and moderation foundation

Include:
- migrations;
- RLS;
- advertiser profiles;
- campaigns;
- creatives;
- payment records;
- entitlements;
- reservations;
- moderation audit;
- admin roles;
- report queue;
- feature flags;
- tests.

### Phase 3 - Real payment integration

Include:
- payment provider integration;
- idempotent checkout;
- webhooks;
- refunds;
- chargeback state;
- ledger reconciliation;
- Promo Credit split payment;
- inventory reservation transaction;
- finance dashboard;
- sandbox and failure tests.

### Phase 4 - Personalization V1

Rules-based and explainable:
- explicit interests;
- categories;
- list matching;
- likes;
- saves;
- shares;
- hides;
- recency;
- diversity;
- frequency caps;
- broad location where permitted;
- `Why am I seeing this?`.

### Phase 5 - Advertiser analytics and optimization

Include:
- validated event pipeline;
- funnel analytics;
- time / placement performance;
- campaign comparison;
- reuse;
- recommendations;
- ad-fatigue warnings;
- claim / redemption metrics if enabled.

### Phase 6 - Learned ranking / ML

Only after enough trustworthy data exists.

Requirements before launch:
- offline evaluation dataset;
- baseline rules comparator;
- privacy review;
- prohibited-feature list;
- model versioning;
- feature importance / explanation strategy;
- A/B or canary testing;
- rollback to deterministic ranking;
- fairness and new-advertiser discovery checks;
- drift monitoring.

### Phase 7 - Advanced marketplace

Possible later features:
- follow advertiser;
- merchant redemption scanner;
- multi-location campaigns;
- creative variants / A/B testing;
- automated budget recommendations;
- campaign templates;
- advertiser teams / roles;
- invoicing for enterprise advertisers;
- API for major retailers;
- retailer product-feed integrations;
- dynamic product promos;
- smarter list-to-promo matching;
- in-app coupon wallet;
- loyalty partnerships;
- sponsored-but-verified price comparison placements with strict labeling;
- contextual notification campaigns with user opt-in.

## 23. Acceptance criteria for first working branch preview

A preview is not accepted unless all of the following are demonstrable:

### Shopper
- Home displays a real promo card from seeded campaign data.
- Promo card clearly says Promoted/Sponsored.
- Like works and state persists.
- Save works and state persists.
- Share launches a real share/deep-link flow or documented web fallback.
- Promo Detail opens in-app.
- Not Interested updates state.
- Report flow exists.
- Promos tab can browse at least several categories.
- explicit interests can be selected.
- Saved Promos can be opened.

### Advertiser
- user can enter advertiser mode/dashboard;
- create campaign;
- choose industry/category;
- add campaign copy;
- upload or choose creative;
- choose CTA;
- choose placement;
- choose duration;
- choose time window where supported;
- preview campaign;
- see plan benefit / price calculation;
- complete test payment / entitlement submission;
- campaign becomes Paid/Under Review;
- see campaign status;
- receive changes-requested state;
- edit and resubmit without new payment where rules allow;
- reuse a prior campaign;
- see seeded or real analytics.

### Admin
- secure role-gated admin route;
- queue shows submitted campaign;
- admin sees payment and campaign details;
- approve works;
- request changes works;
- reject works;
- refund / restore credit action is represented safely;
- publish/schedule works;
- published campaign becomes visible to shopper;
- pause works;
- audit log records privileged actions.

### Engineering
- feature flag exists;
- no direct `main` changes;
- typecheck passes;
- relevant tests pass;
- state transitions are tested;
- unauthorized role tests exist;
- idempotency tests exist for payment/entitlement boundaries when implemented;
- logs use correlation IDs;
- no secrets in repository;
- failure log is updated for meaningful failures;
- rollback instructions exist before production rollout.

## 24. Success metrics

Do not optimize only for ad revenue.

### Shopper health
- promo hide rate;
- report rate;
- promo-related app abandonment;
- user retention;
- saved-promo usefulness;
- category preference use;
- percentage of users who disable personalization;
- complaint rate.

### Advertiser health
- repeat advertiser rate;
- campaign reuse rate;
- campaign completion rate;
- save rate;
- CTA rate;
- claim/redemption rate;
- cost per engagement;
- advertiser retention;
- refund / rejection rate;
- campaign satisfaction.

### Marketplace health
- inventory fill rate;
- over-concentration by one advertiser;
- new-advertiser discovery;
- moderation turnaround;
- invalid traffic rate;
- revenue per active shopper without damaging shopper retention;
- percentage of ads with meaningful interaction;
- frequency / fatigue indicators.

The true North Star is not `maximum impressions`. It is sustainable value on both sides: shoppers repeatedly find promotions useful, and advertisers repeatedly receive measurable outcomes worth paying for.

## 25. Decisions already locked from product discussion

1. Promos is a real Smart Shopper product surface, not a generic third-party ad widget.
2. Home has a Promos Spotlight.
3. Promos has a bottom-nav destination / dedicated feed.
4. Advertising is open to eligible non-Premium users through pay-per-campaign purchase.
5. Premium plans may include campaign days / credits / placements / time-slot benefits.
6. No unlimited advertising plan is assumed.
7. Payment happens during submission, before moderation completes.
8. Reasonable change requests preserve the paid transaction.
9. Genuine policy rejection may trigger refund / credit restoration according to policy.
10. Payment status, moderation status, and delivery status are separate.
11. Paid scarce inventory should be reserved during review.
12. Advertisers get a dedicated dashboard.
13. Advertisers can reuse campaigns.
14. Shopper Like and Save are core actions.
15. Share is also a core action.
16. Hide / Not Interested and Report must exist.
17. Advertiser analytics include likes, saves, shares, opens, reach, and CTA actions.
18. Advertiser analytics are aggregated; shoppers' private data is not exposed.
19. Advertisers choose industries/categories/topics.
20. Shoppers can explicitly choose promo interests and browse categories.
21. Recommendation learns multiple non-sensitive interests over time.
22. Active shopping-list intent can be a powerful ranking signal.
23. The algorithm must preserve nuance, recency, diversity, and exploration.
24. Sensitive traits are not inferred for ad targeting.
25. Admin can run broad/general campaigns, with policy disclosure and frequency controls.
26. AI/ML may assist advertisers with optimization but may not silently alter campaigns.
27. Design quality is a release requirement; AI image mockups may be used to establish a visual reference before implementation.
28. Development remains on a separate branch until explicit approval to merge.
29. Feature failures and fixes are documented chronologically and append-only.
30. Code must be robust, properly structured, appropriately commented, tested, observable, and reversible.

## 26. Decisions still open and must not be guessed

The following require explicit product decision or validated implementation research:
- payment provider;
- currency strategy beyond initial market;
- exact pricing;
- exact Premium plan entitlements;
- exact Home Spotlight capacity;
- exact time-slot definitions;
- inventory pricing formula;
- refund SLA;
- whether processing fees are refundable;
- campaign-change grace period;
- advertiser identity verification threshold;
- prohibited / restricted category matrix;
- political advertising stance;
- alcohol / tobacco / gambling stance;
- age-verification strategy;
- minimum advertiser analytics cohort size;
- raw event retention duration;
- exact location granularity;
- production ML technology;
- exact conversion attribution window;
- whether claim/redemption launches in V1 or later;
- whether `Follow advertiser` launches in V1 or later.

Do not hard-code assumptions for these items.

## 27. Required companion documents

This directory should contain and maintain:
- `README.md` - this North Star;
- `DECISIONS.md` - append-only decisions and changes;
- `FAILURE-LOG.md` - append-only failures, fixes, verification, prevention;
- future `ADVERTISING-POLICY.md`;
- future `TAXONOMY.md`;
- future `DATA-CONTRACTS.md`;
- future `TEST-MATRIX.md`;
- future `ROLLBACK-RUNBOOK.md`;
- future design references / links.

## 28. Working rule for every future session

Before changing Promo code or schema:
1. read `AGENTS.md`;
2. read `docs/proper-implementation.md`;
3. read this North Star;
4. read the latest entries in `DECISIONS.md`;
5. read `FAILURE-LOG.md` for prior issues in the subsystem;
6. search the repository for existing implementations before adding new ones;
7. confirm work is on the Promos feature branch or an approved child branch;
8. write or update acceptance criteria for the slice;
9. implement with tests, comments where intent is non-obvious, logging, safe errors, and rollback awareness;
10. preview and verify before requesting merge.

No future session should have to infer the intended product from scattered chat history. This document is the product and engineering source of truth until superseded by an explicitly documented decision.