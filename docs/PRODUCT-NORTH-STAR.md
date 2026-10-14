# Smart Shopper — Product North Star

## Status

- Product: Smart Shopper
- Scope: whole application and connected operating products
- Document type: living product charter / highest-level product North Star
- Development branch for current documentation work: `feature/promos-marketplace`
- Historical decisions remain in feature/project decision logs; this document describes current intended product truth.

## 1. Purpose

Smart Shopper helps people plan purchases, understand prices, discover relevant opportunities, and make more informed spending decisions.

The product should reduce the effort and uncertainty involved in everyday shopping by connecting:

- what the user intends to buy;
- what products and brands mean;
- where items are available;
- what they cost now and historically;
- what a fair or strong price looks like;
- what the user has bought before;
- what may be worth buying next;
- what legitimate promotions are relevant to current or longer-term intent.

Smart Shopper is not primarily an advertising app. Advertising and commercial marketplace features must strengthen the shopper utility rather than displace it.

## 2. Core product promise

A shopper should increasingly be able to answer, with less effort:

1. What do I need?
2. Where should I buy it?
3. What should it reasonably cost?
4. Is this actually a good deal?
5. What have I spent and how is that changing?
6. Is there a relevant promotion that improves this purchase decision?

The product should become more useful as the user intentionally interacts with it, while preserving user control, privacy, and explainability.

## 3. Product hierarchy

The product should be understood as five connected layers.

### Layer 1 — Shopping execution

Core everyday utility:
- lists;
- item capture by text, voice, camera/photo, or other supported methods;
- categories;
- Library;
- stores;
- receipts;
- collaboration/shared lists;
- saved items, bundles, and related shopping organization.

This layer must remain dependable because all higher intelligence depends on trustworthy shopping data.

### Layer 2 — Shopping intelligence

Turns captured activity into decision support:
- normalized unit prices;
- price history;
- store comparison;
- brand-aware comparison;
- cheapest-store evidence;
- spending history;
- heatmaps;
- budget/trip intelligence;
- alerts;
- price confidence/trust signals.

Paid placement must never corrupt or masquerade as this evidence.

### Layer 3 — Recommendation intelligence

Uses first-party, permission-appropriate context to reduce work and surface useful next actions:
- suggested list additions;
- likely restocks;
- relevant products/categories;
- meal/menu/list connections;
- price opportunities;
- relevant promotions;
- timing/context suggestions.

Start with explainable deterministic rules where possible. Use learned ranking/ML only when enough trustworthy data exists, it provides measurable improvement, and a deterministic rollback/fallback remains available.

### Layer 4 — Commercial marketplace

Promos creates a marketplace in which advertisers can pay to reach relevant shoppers while Smart Shopper preserves shopper trust.

The marketplace may support:
- sponsored placements;
- category/context relevance;
- paid campaigns;
- subscription/entitlement advertising benefits;
- saved offers;
- coupons/promo passes;
- tracked outbound actions;
- measurable redemption and conversion;
- advertiser analytics;
- creative assistance;
- repeat campaign optimization.

Promos must remain clearly labeled as sponsored content and must not convert organic Smart Shopper rankings such as `Cheapest`, `Best Deal`, or price-comparison evidence into pay-to-win labels.

### Layer 5 — Operational platform

Smart Shopper requires internal tools to operate safely at scale.

The Command Center may manage:
- advertisers;
- campaigns;
- creatives;
- ad inventory and commercial pricing;
- moderation/trust;
- customer support;
- engagement;
- configuration-driven app experiences;
- analytics;
- payments/credits/refunds;
- feature controls;
- system health;
- audit and emergency controls.

Operational power must be permissioned, auditable, reversible, and separated from the normal shopper application.

## 4. Product priority order

When priorities conflict, use this order unless an explicit product decision supersedes it:

1. shopper trust and safety;
2. core shopping utility and correctness;
3. shopping intelligence and decision quality;
4. relevance and convenience;
5. commercial value and monetization;
6. decorative or novelty functionality.

Revenue is important, but monetization that materially weakens shopper trust or core usefulness is self-defeating.

## 5. Shopper trust rules

### 5.1 Paid and organic truth stay separate

Paid campaigns are labeled.

An advertiser cannot purchase:
- `Cheapest` status;
- false `Best Deal` status;
- manipulated price comparison;
- organic recommendation labels that imply independent Smart Shopper evidence.

### 5.2 Privacy is a product feature

Private shopping data remains inside Smart Shopper except where the user explicitly exports/shares it or a documented integration requires otherwise.

Advertisers should receive aggregate performance and conversion information, not private shopper lists or identifiable behavior dossiers.

Sensitive traits must not be inferred for ad targeting.

### 5.3 User control matters

Where personalization exists, the user should have meaningful controls such as:
- explicit interests;
- Like/Save/Share;
- Hide;
- Not Interested;
- Report;
- notification preferences;
- `Why am I seeing this?`;
- applicable personalization controls.

### 5.4 Measurement must be honest

Do not call a click a purchase.

Do not call a save a redemption.

Do not present advertiser-reported conversions as Smart Shopper-verified conversions without clearly identifying the evidence level.

## 6. Commercial product boundary

Smart Shopper should create commercial value without unnecessarily becoming the merchant of record for every advertiser transaction.

Preferred boundary:
- Smart Shopper may distribute, save, claim, validate, and measure promotional offers;
- Smart Shopper may track outbound traffic and receive verified conversion signals;
- physical promotions may be redeemed through Smart Shopper Promo Pass/QR flows;
- online purchases, event tickets, bookings, and service payments normally remain with the advertiser or its existing commerce/ticketing provider unless a future explicit product decision changes this boundary.

This keeps the marketplace measurable without taking on avoidable settlement, chargeback, ticket issuance, inventory ownership, and merchant-liability complexity.

## 7. Product intelligence model

Smart Shopper should favor a hybrid of:
- explicit user choices;
- active shopping context;
- recent non-sensitive intent;
- longer-term non-sensitive affinity;
- contextual/product/category matching;
- transparent business rules;
- later learned ranking when justified.

A person may have many simultaneous interests. Do not reduce a user to one inferred identity.

Recent intent and long-term affinity are separate concepts and should decay/update differently.

## 8. First-party data advantage

Smart Shopper's strategic advantage is not merely ad inventory.

It is the ability to understand first-party shopping context such as:
- list items;
- product/category intent;
- pricing context;
- store context;
- previous interactions;
- explicit promotion interests;
- saved/claimed offers;

and use that context inside Smart Shopper to make the application more useful.

Example:

A shopper has detergent, chicken, and rice on an active list. An eligible retailer campaign includes chicken and detergent. Smart Shopper can surface that match instead of showing an unrelated random advertisement.

The advertiser receives performance results, not the shopper's private list.

## 9. Monetization principles

Promos and future monetization should follow usefulness.

Good monetization:
- relevant sponsored offers;
- measurable commercial outcomes;
- fair placement inventory;
- transparent sponsored labeling;
- advertiser tools that improve creative and targeting;
- subscriptions/entitlements that provide real value;
- optional premium utility features.

Poor monetization:
- overwhelming Home with ads;
- hiding organic price truth behind payment;
- selling sensitive targeting;
- fake scarcity;
- opaque billing;
- unlimited advertising that ignores capacity/frequency;
- disguising ads as impartial Smart Shopper recommendations.

## 10. Product design direction

Smart Shopper's consumer experience should remain simple, useful, and visually calm even as the platform grows.

The established direction favors:
- light/neutral surfaces;
- generous whitespace;
- clear hierarchy;
- dark navy/charcoal text;
- vibrant colors and gradients as controlled accents;
- purposeful motion;
- accessible contrast;
- responsive and mobile-first shopper behavior.

Business/internal products may be denser, but should remain coherent with Smart Shopper's brand language.

## 11. Engineering direction

Product growth must not erase the existing engineering integrity rules.

Prefer:
- modular features rather than adding large new subsystems directly into already-large screens;
- first-party shared contracts;
- server-side authorization and financial enforcement;
- RLS where appropriate;
- typed state models;
- idempotent create/charge/redeem flows;
- transactional accounting/reservations;
- feature flags;
- preview/staging before merge;
- observability;
- append-only incident/decision history where designated;
- reversible releases;
- reuse of existing notification, runtime-config, taxonomy, and backend patterns where sound.

Do not perform unrelated large refactors merely because a new feature is being introduced.

## 12. Product surfaces and North Stars

This Product North Star sits above feature/component North Stars.

Current Promos North Stars:
- `docs/features/promos-marketplace/SHOPPER-EXPERIENCE-NORTH-STAR.md`
- `docs/features/promos-marketplace/ADVERTISER-NORTH-STAR.md`
- `docs/features/promos-marketplace/COMMAND-CENTER-NORTH-STAR.md`
- shared relationship map: `docs/features/promos-marketplace/NORTH-STARS.md`
- shared offer/redemption contract: `docs/features/promos-marketplace/OFFER-REDEMPTION-CONTRACT.md`

A component North Star may add detail, but should not silently contradict this product charter.

## 13. Direction-change rule

Do not change Smart Shopper's overall product direction merely because a newly developed feature is exciting, technically sophisticated, or monetizable.

A material direction change should be deliberate and supported by evidence such as:
- meaningful user behavior;
- retention/usefulness data;
- validated customer demand;
- commercial evidence;
- trust/safety implications;
- implementation feasibility;
- clear superiority to the existing direction.

When a better direction is found, document why it is better and what it supersedes.

## 14. Product health metrics

No single metric should define success.

The product should eventually track a balanced set of measures across:

### Shopper utility
- active shoppers;
- list creation/use;
- successful capture/receipt flows;
- price-comparison usage;
- savings/decision-support engagement;
- retention;
- shared-list activity;
- recommendation usefulness.

### Trust/quality
- error rate;
- incorrect price/category reports;
- user hides/reports;
- notification opt-outs;
- ad fatigue;
- support incidents;
- privacy/safety events.

### Commercial marketplace
- active advertisers;
- repeat advertisers;
- fill rate;
- campaign performance;
- saves/claims/redemptions;
- verified conversion where measurable;
- revenue;
- refunds;
- advertiser retention.

Commercial success should be evaluated alongside shopper retention and trust, not in isolation.

## 15. Current implementation reality

The Product North Star is intentionally durable and does not attempt to describe every currently implemented or missing screen.

Use `docs/SMART-SHOPPER-CURRENT-STATE.md` for the dated implementation reality map.

## 16. North Star statement

> Smart Shopper should make shopping decisions easier and more informed by combining planning, price intelligence, relevant first-party recommendations, and trustworthy commercial opportunities. Monetization must reinforce shopper usefulness rather than replace it.