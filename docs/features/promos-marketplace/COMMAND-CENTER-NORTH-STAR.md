# Smart Shopper Command Center — North Star

## Status

- Component: internal Promos Marketplace + Smart Shopper operations control plane
- Intended surface: dedicated desktop-first web application
- Suggested domain: `admin.smartshopper.com`
- Parent feature: Promos Marketplace
- Development branch: `feature/promos-marketplace`
- Document type: living specification
- Related North Stars:
  - `SHOPPER-EXPERIENCE-NORTH-STAR.md`
  - `ADVERTISER-NORTH-STAR.md`
- Shared map: `NORTH-STARS.md`

## 1. Purpose

The Smart Shopper Command Center is not an admin tab inside the consumer app.

It is a separate desktop-first operations product with its own authentication, permissions, deployment boundary, interface, audit history, and safety controls.

Its job is to operate the Smart Shopper advertising marketplace and selected configuration-driven consumer experiences without requiring an application code deployment for every commercial or content change.

The Command Center should feel like a true operational control plane rather than a simple moderation dashboard.

## 2. North Star outcome

Authorized Smart Shopper staff should be able to understand what is happening across the marketplace and take controlled action from one place.

The platform should support:
- real-time operational overview;
- advertiser/account management;
- campaign operations;
- moderation;
- Creative Studio;
- inventory and pricing control;
- paid entitlement integrity;
- internal bonuses/adjustments;
- advertiser analytics;
- cross-advertiser marketplace analytics;
- Smart Shopper platform analytics;
- customer engagement;
- Experience Manager controls over approved consumer-app surfaces;
- payment/credit/refund operations;
- customer support tooling;
- trust and safety;
- feature flags;
- system health;
- emergency controls;
- audit history;
- configurable settings domains.

## 3. Product boundary

### 3.1 Separate web application

The Command Center should be reachable from a separate domain/login such as:

`admin.smartshopper.com`

It should not be exposed through normal shopper navigation.

### 3.2 Shared backend, separate authorization boundary

It may share backend data/services with Smart Shopper, but internal operations require dedicated authorization and role checks.

A consumer account must never gain admin capability simply by discovering an internal route.

### 3.3 Desktop-first

The Command Center is designed primarily for desktop/laptop use.

Mobile access may exist for urgent operational review, but the primary information architecture may use the full viewport and persistent rails.

## 4. Current visual direction

The preferred current design direction is a light command-center interface.

### 4.1 Surface language

Use:
- white/off-white/light gray surfaces;
- substantial whitespace;
- dark navy/charcoal text;
- subtle borders;
- restrained shadows;
- full-width desktop workspace;
- persistent left navigation rail;
- top utility/search rail;
- optional bottom operational/status rail;
- internal panel scrolling where appropriate rather than unnecessarily making the entire page vertically endless.

### 4.2 Color usage

Neon/gem colors should be reserved primarily for:
- chart series;
- icons;
- selected navigation state;
- alerts/statuses;
- highlights;
- key actions;
- controlled gradient accents.

Preferred accent family includes:
- light yellow;
- blue;
- dark blue;
- purple;
- pink;
- red;
- gray;
- supporting green for positive/operational states where necessary.

Do not flood the interface with multiple saturated gradients at once.

Color should be decorative and semantic rather than becoming the dominant background treatment.

## 5. Primary navigation architecture

Current recommended major sections:

1. Overview
2. Advertisers
3. Campaigns
4. Creative Studio
5. Inventory & Pricing
6. Analytics
7. Experience Manager
8. Engagement
9. Payments & Credits
10. Moderation & Trust
11. Users & Support
12. System Control
13. Audit Log
14. Settings

This is a living information architecture. A section should exist only where there is a real operational responsibility.

## 6. Command Overview / Home

The homepage should act as an operational command overview, not as a decorative dashboard.

It should answer:
- What needs attention now?
- What is performing well or badly?
- Where is inventory constrained?
- Are payments working?
- Are campaigns waiting for review?
- Are advertiser renewals/opportunities being missed?
- Are app/system components healthy?
- Are there anomalies, fraud signals, or safety issues?

### 6.1 Recommended overview metrics

Potential top-level summary metrics:
- ad revenue for selected period;
- active campaigns;
- viewable impressions;
- active advertisers;
- fill rate;
- campaign reuse rate;
- pending moderation;
- payment failures/refunds;
- active Smart Shopper users where relevant;
- system health.

### 6.2 Performance overview

Use interactive graphics for:
- revenue;
- impressions/viewable impressions;
- promo opens;
- saves;
- CTA actions;
- claims/conversions where supported.

### 6.3 Alerts and opportunities

The homepage should surface operationally actionable items such as:
- campaigns expiring in 3 days;
- inventory nearing capacity;
- creatives waiting for approval;
- payment verification/failure;
- high-performing campaigns with no follow-up;
- dormant high-value advertisers;
- unusual refund rates;
- unusually low CTR/save rate;
- sudden traffic/engagement anomalies.

Every alert/opportunity should link to a real control surface.

### 6.4 Quick actions

Examples:
- Create Campaign;
- Generate Creative;
- Adjust Inventory;
- Send Announcement;
- View Reports;
- Manage Advertiser.

Quick actions should only be shown if the logged-in role has permission.

### 6.5 Activity feed

Show meaningful recent operations such as:
- advertiser registered;
- campaign paid/submitted;
- campaign approved;
- campaign paused;
- creative generated/approved;
- refund issued;
- inventory override applied;
- experience configuration published;
- system control changed.

## 7. Analytics architecture

Analytics inside Command Center must be split into three distinct perspectives.

### 7.1 Advertiser Analytics

Purpose:
- inspect one advertiser or one campaign in depth;
- support account management, troubleshooting, optimization and renewal.

Admin should be able to see essentially the same campaign-performance truth available to the advertiser, plus authorized operational context.

Potential metrics/visuals:
- impressions;
- viewable impressions;
- unique reach;
- frequency;
- opens;
- likes;
- saves;
- shares;
- CTA actions;
- claims/redemptions;
- spend/entitlement consumption;
- placement comparison;
- time heatmap;
- creative performance;
- campaign comparison;
- optimization opportunities.

### 7.2 Marketplace Analytics

Purpose:
- understand the advertising business across all advertisers.

Potential metrics:
- marketplace revenue;
- active advertisers;
- new advertisers;
- returning advertisers;
- advertiser retention;
- campaign reuse rate;
- inventory fill rate;
- demand by placement;
- demand by category;
- average campaign performance;
- average spend;
- renewal/extension rate;
- moderation turnaround;
- refund rate;
- revenue by category/region/placement;
- underused inventory;
- oversubscribed inventory.

### 7.3 Smart Shopper Platform Analytics

Purpose:
- understand Smart Shopper as a product/business, not just the advertising marketplace.

Potential metrics:
- active users;
- sessions;
- retention;
- shopping lists created;
- receipt activity;
- product/category usage;
- Promos engagement;
- ad load effects on user retention/satisfaction;
- subscription revenue;
- advertising revenue;
- notification engagement;
- recommendation quality;
- feature adoption;
- error/system-health metrics.

Marketplace performance and platform health must not be conflated.

## 8. Analytics design rules

Analytics should always include meaningful graphics.

Use appropriate:
- line/area charts;
- bars/stacked bars;
- funnels;
- heatmaps;
- cohort/retention curves;
- distribution charts;
- occupancy visualizations;
- timelines;
- comparison plots.

Numbers/cards may support charts but should not replace them.

Motion should be subtle and useful:
- animated chart transitions;
- hover/tap tooltips;
- smooth filter changes;
- drill-down interaction;
- reduced-motion support.

## 9. Advertiser 360

Each advertiser should have a complete operational page.

### 9.1 Identity/account header

Display:
- advertiser name;
- advertiser type/category;
- verification status;
- account status;
- region/base where appropriate;
- assigned account manager where used;
- contact action.

### 9.2 Account summary

Potential summary metrics:
- lifetime spend;
- active campaigns;
- average ROAS/defined performance score where attribution supports it;
- renewal likelihood;
- policy status;
- support health;
- account age.

### 9.3 Campaigns

Admin can inspect:
- live;
- scheduled;
- under review;
- changes requested;
- completed;
- draft;
- paused campaigns.

### 9.4 Financial integrity

Separate and display:
- purchased entitlement/value;
- complimentary credits/days;
- adjustments;
- refunded value;
- delivered units/days;
- reserved inventory;
- payment history.

### 9.5 Creative library

Show:
- current creatives;
- historical creatives;
- generated variations;
- approved versions;
- performance where available.

### 9.6 Support timeline

Internal staff should see a chronological account timeline containing authorized:
- notes;
- support conversations;
- campaign events;
- policy decisions;
- credits/adjustments;
- account contacts.

### 9.7 Opportunities

Examples:
- extend high-performing campaign;
- upgrade placement;
- follow up on expiring campaigns;
- generate new creative;
- reuse successful creative;
- recommend always-on/repeat strategy;
- use remaining Promo Days.

## 10. Admin advertiser controls

Authorized Admin should generally have all advertiser campaign controls plus controlled internal-only capabilities.

Advertiser-equivalent capabilities may include:
- create campaign;
- duplicate/reuse;
- edit draft;
- upload creative;
- generate creative;
- select category;
- choose targeting eligibility;
- choose placement;
- schedule;
- preview;
- pause/resume where policy allows;
- inspect analytics.

Internal-only capabilities may include:
- create campaign on behalf of advertiser;
- grant complimentary days;
- issue Promo Credits;
- extend campaign;
- upgrade placement;
- reserve inventory manually;
- waive approved cost;
- issue refund;
- restore entitlement;
- pause account;
- block advertiser;
- create internal note;
- send advertiser communication;
- create optimization proposal.

All consequential internal actions require authorization and audit entries.

## 11. Commercial integrity: Contract vs Delivery

A campaign should conceptually expose two separate operational views.

### 11.1 Commercial Agreement

Records what was purchased/contracted.

Example:
- 7 Home Spotlight days;
- evening placement;
- St. Ann;
- JMD $8,500;
- payment transaction ID;
- purchase timestamp.

This historical truth should not be overwritten.

### 11.2 Delivery Plan

Records what Smart Shopper currently intends to deliver.

Example:
- 7 paid days;
- +2 complimentary days;
- +1 Featured Feed upgrade;
- actual scheduled dates/time windows;
- targeting eligibility;
- pacing.

The delivery plan may change through audited adjustments while commercial truth remains intact.

## 12. Adjustment ledger

Do not change `7 paid days` into `10 paid days` merely because Admin grants 3 free days.

Use ledger-style adjustments.

Examples:
- `Purchased entitlement: +7 Home Spotlight days`
- `Admin goodwill adjustment: +3 Home Spotlight days`
- `Admin correction: -1 complimentary day`
- `Refund restoration: +2 Promo Days`

Every entry should include:
- type;
- quantity/value;
- eligible placement;
- reason;
- staff actor;
- timestamp;
- linked campaign/account/payment;
- approval where required.

## 13. Approval thresholds for internal generosity/financial actions

Not every staff member should be able to give away unlimited inventory or money-equivalent credits.

Potential policy model:
- small account-management goodwill credit: single authorized role;
- medium adjustment: manager approval;
- large value/strategic adjustment: senior/commercial approval;
- refunds: finance permissions;
- price configuration: restricted commercial role;
- systemwide free inventory: super-admin/commercial control.

Exact thresholds remain a policy decision.

## 14. Inventory & Pricing Control

Inventory management is a first-class Command Center module.

It must answer:
- what inventory exists;
- how much is sellable;
- how much is reserved;
- how much is sold;
- how much is complimentary/internal;
- what is blocked;
- where demand is high/low;
- whether the marketplace risks overselling;
- what each slot currently costs.

### 14.1 Placement definitions

Potential placement inventory:
- Home Spotlight;
- Promos Feed;
- Category Featured;
- Search Sponsored;
- Featured Evening;
- future placement types.

Each placement definition may include:
- capacity;
- impression/delivery model;
- allowed campaign categories;
- geographic eligibility;
- supported time slots;
- Premium eligibility;
- pricing basis;
- fallback behavior;
- frequency rules.

### 14.2 Inventory schedule

Admin should see time-based capacity/occupancy by placement.

Potential states:
- available;
- reserved;
- sold;
- premium/priority;
- blocked/blackout;
- internal/complimentary.

### 14.3 Pricing controls

Potential controls:
- base price;
- demand multiplier;
- weekend surcharge;
- seasonal multiplier;
- premium-placement multiplier;
- dynamic-pricing eligibility;
- minimum/maximum bounds;
- promotional pricing;
- effective dates.

Pricing changes need history and effective dates.

Do not silently rewrite historical campaign prices.

### 14.4 Manual overrides

Authorized controls may include:
- add bonus days;
- upgrade placement;
- reserve inventory;
- block/blackout dates;
- pause sales for a slot;
- add internal notes;
- manually move eligible campaign delivery;
- release reservation.

Manual actions require reasons and audit trails.

### 14.5 Forecasting

The module should eventually provide:
- future demand forecast;
- expected occupancy;
- oversell risk;
- underused placement opportunities;
- category demand;
- pricing recommendations.

## 15. Creative Studio for internal operations

The Command Center should include the full professional Creative Studio.

Admin should be able to:
- load an advertiser/campaign;
- access Brand Profile;
- upload assets;
- generate template-based graphics;
- generate/edit AI visual assets;
- refine copy;
- swap background;
- apply approved brand colors;
- generate multiple placement/aspect variants;
- preview in context;
- compare variations;
- run quality checks;
- request/record review;
- approve creative;
- preserve creative version history;
- reuse prior creative.

The Studio should remain controlled and deterministic for logos, prices, dates, CTA text and campaign truth.

AI is an assistant, not the source of commercial facts.

## 16. Experience Manager

Experience Manager controls approved configurable surfaces in the Smart Shopper consumer app.

It is not an arbitrary code editor.

### 16.1 Supported surface concept

Engineering explicitly exposes configurable surfaces such as:
- Home;
- Promos;
- Search;
- Category Pages;
- Product Pages;
- Saved Promos;
- Notifications/announcement surfaces.

### 16.2 Module-based configuration

Potential approved modules:
- Promo Spotlight;
- Announcement Banner;
- Shopping Stats;
- Price Drops;
- Recommendations;
- Category Carousel;
- Sponsored Collection;
- Saved Offers Reminder;
- future engineered components.

Admin may control supported properties such as:
- visibility;
- ordering;
- content source;
- campaign source;
- schedule;
- audience eligibility;
- region/device targeting;
- approved style variant;
- fallback behavior;
- feature flag;
- experiment allocation.

### 16.3 What Experience Manager must not do

It must not:
- inject arbitrary JavaScript;
- inject arbitrary React components;
- bypass app authorization;
- alter schema/business logic without engineering;
- publish unsupported configuration fields;
- make hidden breaking API changes.

### 16.4 Preview → Publish workflow

Recommended flow:
1. Draft;
2. Preview;
3. Schedule or publish;
4. Observe;
5. Rollback if needed.

Every published experience configuration should be versioned.

Example:
- Home Experience v42;
- Home Experience v43.

Admin can rollback to a known-good version.

### 16.5 Environment separation

Experience/configuration management should distinguish environments such as:
- Development;
- Preview/Staging;
- Production.

A tested configuration can be promoted rather than manually recreated.

## 17. Engagement / communications

The Command Center should eventually manage approved customer/advertiser communications.

Potential channels:
- in-app announcement;
- push notification;
- advertiser notification center;
- saved-promo expiry reminder;
- campaign moderation message;
- campaign renewal prompt;
- maintenance notice;
- product update announcement.

All communication must respect appropriate preferences/consent and role permissions.

## 18. Payments & Credits

Internal finance/operations views should support:
- payment status;
- settlement/provider reference;
- failed payments;
- refunds;
- partial refunds;
- Promo Credits;
- subscription entitlements;
- purchased entitlements;
- bonus adjustments;
- reconciliation;
- disputes where applicable.

Client/admin UI cannot simply mark a payment `paid` without trusted server/provider confirmation.

## 19. Moderation & Trust

Moderation needs more than Approve/Reject.

Potential queues:
- Paid · Under Review;
- Changes Requested;
- High Risk;
- Reported by users;
- Verification required;
- Refund/rejection follow-up;
- Scheduled awaiting final checks;
- appeals where supported.

Moderator should see:
- campaign preview;
- advertiser identity/history;
- creative versions;
- offer/terms;
- CTA destination;
- payment state;
- inventory reservation;
- policy indicators;
- previous violations;
- report history;
- notes/audit context.

Actions:
- approve;
- request changes;
- reject + initiate defined refund/credit path;
- pause;
- escalate;
- add note;
- verify advertiser;
- inspect destination links.

## 20. Users & Support

Support tooling should allow authorized staff to investigate problems without unnecessary access to private user information.

Potential capabilities:
- search user/advertiser;
- view account state;
- view permitted transaction/campaign history;
- investigate missing credits;
- investigate campaign/payment issues;
- resend allowed transactional notifications;
- grant approved support adjustment;
- create/escalate case;
- add internal notes;
- see prior support timeline;
- link related system incidents.

Role-based privacy restrictions are mandatory.

A basic support agent should not automatically be able to:
- alter global pricing;
- grant unlimited advertising inventory;
- modify production Experience Manager config;
- access unnecessary private shopping behavior;
- grant admin roles.

## 21. System Control

System Control contains operational safety controls.

Potential kill switches:
- disable all Promos serving;
- disable a specific placement;
- pause one advertiser;
- pause campaign submissions;
- disable new Promo payments;
- disable personalized ranking while keeping safe contextual/general feed;
- disable a failing integration;
- enable maintenance mode for selected surfaces;
- stop scheduled publication;
- switch to safe fallback configuration.

High-impact controls require restricted permissions, explicit confirmation, reason capture, and audit logging.

## 22. Feature flags and experiments

Command Center may expose approved feature-control capabilities such as:
- feature on/off;
- percentage rollout;
- audience group;
- app-version constraint;
- region constraint;
- A/B experiment;
- preview-only state.

Feature flags must not become a substitute for proper authorization.

## 23. System health

Command Center should expose operational health for systems that materially affect customers/advertisers.

Potential services:
- application/API;
- database;
- ad serving/ranking;
- payment provider;
- background jobs/scheduler;
- push/notifications;
- media/creative processing;
- recommendation engine;
- storage/CDN;
- queue/webhooks.

Surface:
- health state;
- latency;
- recent failures;
- job backlog;
- error rate;
- last successful run;
- link to incident details/logs where appropriate.

## 24. Audit Log

All consequential internal actions should answer:
- who acted;
- what changed;
- previous value/state;
- new value/state;
- reason;
- timestamp;
- environment;
- affected advertiser/campaign/user/config;
- whether customer/advertiser was notified;
- approval record where relevant;
- correlation/reference ID.

Audit records must be protected from casual modification/deletion.

## 25. Roles and permissions

Potential roles:
- Super Admin;
- Commercial Admin;
- Promo Moderator;
- Finance;
- Customer Support;
- Account Manager;
- Content/Experience Manager;
- Marketing/Growth;
- Analyst;
- Creative/Design role.

Permissions should be capability-based rather than merely hiding navigation links.

Examples:
- moderator can review campaign but cannot alter global prices;
- support can inspect account state but cannot publish Home layout;
- account manager can grant limited goodwill credits but not unlimited inventory;
- analyst can view data but not mutate campaigns;
- finance can process authorized refunds but not change moderation policy.

## 26. Settings architecture

Do not create one miscellaneous settings dumping ground.

Potential governed settings domains:
- Advertising Policy;
- Categories & Taxonomy;
- Placement Definitions;
- Pricing Rules;
- Promo Entitlement Plans;
- Creative Standards;
- Notification/Engagement Rules;
- Recommendation Controls;
- Geographic Regions;
- Payment Configuration;
- Moderation Policy;
- Advertiser Verification;
- Admin Roles/Security;
- Feature Flags;
- Experience Defaults;
- Analytics Definitions/Attribution where appropriate.

Changes to sensitive settings require versioning and audit history.

## 27. Opportunity engine

Command Center should proactively surface commercially/operationally useful opportunities.

Examples:
- advertisers with high engagement and no follow-up campaign;
- campaigns expiring soon;
- high-performing creatives worth reusing;
- underbooked placement/category;
- oversubscribed inventory that may justify pricing changes;
- advertisers with unused Promo Days;
- strong saves but weak CTA rate;
- dormant previously high-value advertisers;
- category demand growth;
- refund/policy pattern requiring attention.

Opportunity recommendations should link to an action, not remain decorative insights.

## 28. View-as-advertiser mode

Authorized internal staff should be able to preview the advertiser experience for a selected advertiser without impersonating credentials.

Purpose:
- support troubleshooting;
- verify what the advertiser can see;
- compare advertiser view to internal data.

This should be read-only unless the staff member explicitly returns to an authorized Admin operation mode.

## 29. Notifications for admin-initiated advertiser changes

When Admin changes something that affects an advertiser, the action may offer `Notify advertiser` where appropriate.

Examples:
- 3 complimentary days added;
- placement upgraded;
- campaign extended;
- creative ready for review;
- refund processed;
- changes requested;
- optimization proposal created.

Notifications should be recorded in the account timeline.

## 30. Security requirements

At minimum:
- dedicated internal authentication;
- MFA for privileged roles;
- server-side authorization;
- no reliance on hidden UI alone;
- strong session controls;
- least privilege;
- sensitive-action confirmation;
- audit logging;
- secure secret management;
- protected admin routes/APIs;
- RLS/service-layer policy appropriate to architecture;
- rate limiting/abuse controls;
- restricted support access to private data.

## 31. Engineering requirements

### Configuration safety

Configuration-driven consumer behavior must have:
- schema validation;
- typed configuration;
- versioning;
- preview validation;
- safe defaults;
- rollback;
- observability.

### Financial safety

Financial/entitlement actions require:
- integer minor-unit money representation where relevant;
- idempotency;
- transactional writes;
- immutable/append-style ledger principles;
- provider webhook verification where applicable;
- reconciliation.

### Inventory safety

Reservation must prevent double booking/overselling through appropriate database constraints/locking/transactions.

### Operational safety

High-impact mutations should be reversible where possible.

## 32. V1/V2 implementation direction

The full Command Center is a large product and should be staged.

### Initial operational foundation
- dedicated admin web shell/login boundary;
- role model;
- Overview;
- advertiser list + Advertiser 360 foundation;
- campaign/moderation queue;
- basic inventory view;
- advertiser analytics access;
- audit logging;
- system kill switches;
- feature flag protection.

### Commercial operations expansion
- adjustment ledger;
- pricing control;
- inventory reservation calendar;
- credit/refund tooling;
- advertiser lifecycle/opportunities;
- support timeline.

### Creative/experience expansion
- Creative Studio;
- Brand Profiles;
- Experience Manager;
- preview/publish/rollback;
- engagement/announcements.

### Advanced intelligence
- demand forecasting;
- optimization engine;
- anomaly detection;
- advertiser renewal likelihood;
- automated opportunity surfacing;
- learned campaign recommendations.

## 33. Open questions that must not be guessed

- exact admin framework/deployment architecture;
- exact domain/subdomain configuration;
- identity provider/MFA implementation;
- final role matrix;
- internal approval thresholds;
- exact pricing model;
- exact inventory unit model;
- whether pricing is fixed, dynamic or hybrid at launch;
- final refund authority/process;
- customer-support case system architecture;
- final Creative Studio API/service stack;
- exact Experience Manager component/property schema;
- which consumer surfaces become remotely configurable in first release;
- exact analytics data warehouse/reporting architecture;
- exact anomaly/fraud tooling;
- final operational notification channels;
- final retention periods for audit/support data.

Keep these explicit until decided.

## 34. Core principle

The Command Center should provide broad operational control without sacrificing integrity.

The goal is not to make everything editable.

The goal is to make the right things safely controllable, observable, auditable, and reversible.