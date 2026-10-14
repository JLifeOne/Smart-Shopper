# Smart Shopper Promos — Offer, Redemption & Conversion Contract

## Status

- Parent feature: Promos Marketplace
- Shared by: Shopper Experience, Advertiser Experience, Command Center
- Development branch: `feature/promos-marketplace`
- Document type: living shared contract
- Purpose: define how saved promotions, coupons, QR passes, external purchase links, redemption, and conversion measurement work without turning Smart Shopper into the merchant of record for every advertiser transaction.

## 1. Core principle

Smart Shopper must distinguish intent from verified commercial outcomes.

The core funnel is:

`Impression → Open → Save → Claim → Redeem → Verified Purchase`

Not every campaign supports every stage, but the meanings must remain distinct.

### Save

Meaning:
- shopper wants to remember or revisit the promotion.

Save does not consume a scarce coupon by default and does not imply purchase.

### Claim

Meaning:
- shopper actively obtains a benefit, code, pass, or entitlement.

Claim may allocate scarce promotional inventory where configured.

### Redeem

Meaning:
- the promotional benefit was presented/consumed according to the campaign's redemption mechanism.

### Verified Purchase / Conversion

Meaning:
- Smart Shopper received evidence that a real commercial outcome occurred.

A click, save, or claim must never be mislabeled as a purchase.

## 2. Product boundary

Smart Shopper may:
- save promotions;
- issue or assign coupons/promo passes;
- track claims;
- validate physical redemption;
- track outbound links;
- receive merchant/provider conversion signals;
- report aggregate conversion analytics;
- optionally support Apple/Google Wallet export later.

Smart Shopper should not initially become the merchant of record for:
- event tickets;
- advertiser products;
- service bookings;
- external ecommerce purchases.

Those purchases normally remain with the advertiser or its existing commerce/ticketing provider.

This avoids unnecessary burden around:
- settlements;
- chargebacks;
- ticket issuance;
- seat inventory;
- merchant tax treatment;
- event cancellation refunds;
- order fulfillment;
- product/service liability.

A future explicit product decision may change this boundary, but it must not happen accidentally as part of Promos implementation.

## 3. Campaign conversion objectives

Advertisers should choose an appropriate campaign objective/conversion action instead of every ad being forced into the same funnel.

Supported conceptual objectives may include:

### Awareness
Primary action:
- View Details.

Measurement:
- impressions;
- viewable impressions;
- unique reach;
- opens;
- engagement.

### Website / ecommerce traffic
Primary action:
- Visit Website.

Measurement:
- tracked outbound visit;
- coupon use where available;
- provider/webhook/postback conversion where integrated.

### Deal / coupon
Primary actions:
- Save;
- Claim Offer;
- Redeem.

### Physical store
Primary actions:
- Save;
- Claim;
- Show/scan Promo Pass;
- optional Directions.

### Event / ticket sale
Primary actions:
- Save Event/Promotion;
- Buy Tickets externally;
- optional coupon code.

Smart Shopper tracks outbound traffic. Ticket issuance/payment remains with the event's ticketing provider unless explicitly changed later.

### Restaurant / service / appointment
Potential actions:
- Call;
- WhatsApp;
- Book externally;
- Directions;
- Claim in-store/service coupon.

### Lead generation
Potential actions:
- Contact;
- enquiry form;
- call/WhatsApp;
- external booking/quote flow.

## 4. Saved Promo / Promo Pass

A promotion containing an offer may be saved into a shopper-facing `Saved Promos` collection or appropriate Library-linked surface.

A saved promotion may display:
- advertiser;
- creative/offer;
- expiry;
- terms;
- status;
- claim action;
- code/QR once claimed;
- uses remaining;
- directions/website/contact actions;
- redemption history/status where appropriate.

Example:

`20% OFF`

`Valid until October 31`

`Claim Offer`

After claim:

`Code: SS-8K4Q-P2`

`1 use remaining`

The user should be able to return to the saved promotion at the point of purchase.

## 5. Save and Claim are separate when scarcity exists

Do not automatically allocate scarce offer inventory merely because a shopper saves an ad.

Example:
- advertiser offers 500 unique 30%-off coupons;
- 10,000 shoppers may save the promotion;
- only explicit `Claim` allocates one of the 500 coupons.

For unlimited or non-scarce campaigns, Save and Claim may be presented with less friction, but the analytics semantics should remain distinguishable.

## 6. Code strategies

Campaigns may support multiple code strategies.

### 6.1 Universal merchant code

Example:
- `SMART20`.

Characteristics:
- easiest setup;
- everyone receives the same code;
- weak individual redemption attribution unless merchant/provider reports code usage;
- useful for external ecommerce/ticketing platforms.

### 6.2 Merchant-supplied unique code pool

The advertiser supplies/imports a set of valid unique codes generated by its existing commerce/ticketing system.

Smart Shopper allocates one code per eligible claim.

Characteristics:
- strong one-to-one claim attribution;
- merchant's existing checkout remains the discount authority;
- avoids requiring Smart Shopper to reproduce the merchant's discount engine;
- supports online merchants with minimal integration burden.

Example allocation:
- shopper A → `X7Q82`;
- shopper B → `KM93D`;
- shopper C → `8V2HA`.

The merchant/provider may later report which assigned codes were used.

### 6.3 Smart Shopper-issued Promo Pass

Smart Shopper generates a unique redemption token/QR for physical-store or low-integration advertisers.

The advertiser/merchant validates it through Smart Shopper's advertiser web dashboard.

Characteristics:
- no POS integration required for V1;
- supports small/local merchants;
- Smart Shopper can verify redemption directly;
- suitable for one-use, multi-use, or date-bounded offers.

## 7. Physical redemption flow

Recommended V1 flow:

1. shopper saves promotion;
2. shopper claims offer if claim is required;
3. Smart Shopper creates/assigns a server-backed Promo Pass;
4. shopper opens the pass at the business;
5. merchant opens `Redeem Smart Shopper Offer` in advertiser dashboard;
6. merchant scans QR or enters code;
7. server validates campaign, pass, validity window, remaining-use limits, and campaign limits;
8. merchant sees offer terms and validity;
9. merchant confirms redemption;
10. server atomically records redemption and decrements applicable remaining-use counters;
11. shopper/merchant receive confirmation;
12. advertiser analytics update from verified redemption events.

The server/database is the trusted authority. The QR image itself is not trusted as proof of unused status.

## 8. One-use / multi-use / unlimited rules

A promotion may define:
- `per_user_limit = 1`;
- `per_user_limit = N`;
- unlimited within the validity period;
- campaign-wide redemption cap;
- claim cap;
- location restrictions;
- start/end timestamps.

Redemption must be atomic so two simultaneous scans cannot both consume the final allowed use.

A one-use Promo Pass that has already been redeemed must return an unambiguous invalid/already-used result.

## 9. Dynamic QR as future fraud protection

V1 may use stable unique server-validated QR/token identifiers.

For higher-value offers, later support may add short-lived rotating/dynamic QR payloads so screenshots are less useful for sharing/fraud.

Dynamic QR should be an additional presentation/security layer; the server-side redemption ledger remains the source of truth.

## 10. External website attribution

When an advertiser sends a shopper to an external website, Smart Shopper should use a tracked redirect rather than exposing only a raw destination URL where feasible.

Conceptual flow:

`Smart Shopper CTA → tracked click/redirect → advertiser destination`

The event may create a pseudonymous `click_id`/attribution token linked to:
- campaign;
- creative;
- placement;
- timestamp;
- permitted aggregate context.

It must not expose the shopper's private list/profile to the advertiser.

Smart Shopper can independently verify:
- CTA click;
- outbound visit.

Smart Shopper cannot independently call that visit a purchase unless a conversion signal is returned.

## 11. Verified online conversions

Potential sources of stronger purchase evidence:

### Merchant coupon redemption report

Merchant/provider reports that a universal or unique code was used.

### Provider integration

Connected commerce/ticketing provider reports redemption/order outcome.

### Webhook / server postback

Merchant sends a server-to-server conversion event referencing an attribution/click/order token.

### Advertiser upload/report

Advertiser uploads a redemption/conversion report.

This is useful but should be labelled differently from Smart Shopper/provider-verified events.

## 12. Measurement-integrity labels

Advertiser analytics should explain the strength/source of conversion evidence.

Recommended labels:

### Smart Shopper Verified
Examples:
- physical Promo Pass redeemed through Smart Shopper scanner;
- Smart Shopper-controlled claim/redemption state.

### Partner Verified
Examples:
- connected commerce/ticketing provider confirmed purchase/redemption.

### Advertiser Reported
Examples:
- advertiser-uploaded redemption/sales report not independently confirmed by Smart Shopper/provider.

### Click Attribution Only
Smart Shopper verified the outbound click, but no purchase confirmation exists.

Do not blend these into one opaque `Conversions` number without breakdown/definition.

## 13. Event/ticket campaigns

Current recommended boundary:
- Smart Shopper does not sell/issue event tickets itself;
- advertiser supplies external ticketing destination;
- Smart Shopper tracks `Buy Ticket` clicks;
- campaign may include a Smart Shopper coupon/promo code;
- ticketing provider may attribute sales through tracking links, codes, webhook/postback, or later integration;
- Smart Shopper may display provider-verified ticket conversions when available.

Example funnel:

`4,201 impressions → 380 opens → 128 saves → 91 Buy Ticket clicks → 34 partner-verified ticket purchases`

This provides commercial measurement without taking on ticketing operations.

## 14. Optional transaction value at physical redemption

For physical redemption, merchant UI may optionally capture a transaction value after confirming the offer.

Example:
- redemption confirmed;
- `Sale value (optional): JMD _____`.

This may support attributed-sales/ROAS reporting.

It should remain optional in early versions because requiring cashier data entry creates operational friction.

Analytics must distinguish merchant-entered values from provider/system-verified order values.

## 15. Campaign offer configuration

Conceptual campaign fields may include:
- `offer_enabled`;
- `offer_type`;
- `code_strategy`;
- `claim_required`;
- `per_user_redemption_limit`;
- `campaign_claim_limit`;
- `campaign_redemption_limit`;
- `valid_from`;
- `valid_until`;
- `eligible_locations`;
- `external_destination`;
- `merchant_code_pool_id`;
- `terms`;
- `redemption_instructions`;
- `wallet_export_eligible` later.

Exact schema names remain an implementation design decision, but the semantics must be preserved.

## 16. Shared data concepts

Do not overload one `saved` or `converted` field.

Conceptual records should remain distinct.

### Saved Promo
Represents bookmark/intent.

Potential data:
- user;
- campaign;
- saved timestamp;
- state/expiry.

### Promo Claim
Represents allocation/request for a benefit.

Potential data:
- user;
- offer/campaign;
- allocated code/token;
- claim timestamp;
- validity;
- status.

### Promo Redemption
Represents benefit consumption.

Potential data:
- claim/pass;
- campaign;
- advertiser/location;
- redeemed timestamp;
- uses consumed;
- verification source;
- optional merchant transaction value.

### Conversion
Represents a commercial outcome with evidence.

Potential data:
- campaign/creative;
- shopper-attribution token where allowed;
- conversion type;
- verification source;
- order/reference ID where appropriately protected;
- value/currency if supplied;
- timestamp.

## 17. Analytics funnel

Advertiser and Command Center analytics should be able to report relevant stages such as:
- impressions;
- viewable impressions;
- unique reach;
- opens;
- likes;
- saves;
- shares;
- claims;
- CTA clicks;
- physical presentations/scans where separately useful;
- redemptions;
- verified purchases/conversions;
- attributed sales value where evidence permits.

Example:

`20,438 impressions`

`2,014 opens`

`713 saves`

`422 claims`

`287 outbound visits / physical presentations`

`194 redemptions`

`142 verified purchases`

Every stage must have a documented event definition.

## 18. Advertiser-facing redemption dashboard

Advertisers should eventually see:
- offers claimed;
- unused claims;
- redemptions;
- redemption rate;
- remaining campaign redemption capacity;
- code-pool availability;
- unique-code status;
- physical scanner/redeem action;
- invalid/already-used scan results;
- conversion verification breakdown;
- optional attributed revenue/ROAS where supported.

Advertisers do not receive private shopper identities merely because a user claimed/redeemed an offer.

## 19. Command Center controls

Authorized internal staff may need controls for:
- offer configuration review;
- code-pool status;
- invalid-code investigation;
- claim/redemption limits;
- campaign-level redemption suspension;
- fraud/anomaly flags;
- manual invalidation/reissue where policy allows;
- restoration after system error;
- advertiser support;
- audit trail;
- conversion-source health;
- provider integration status.

Manual redemption/claim adjustments must be reasoned and auditable.

## 20. Fraud and integrity protections

At minimum:
- unpredictable unique tokens/codes where Smart Shopper issues them;
- server-side validity checks;
- atomic redemption;
- rate limiting;
- campaign/user limit enforcement;
- expiry enforcement;
- advertiser/account authorization on scanner operations;
- replay protection;
- audit events for manual overrides;
- anomaly detection later;
- no reliance on client-side `used=true` state as authoritative.

## 21. Shopper privacy

A merchant scanning a Promo Pass should receive only the information required to validate and fulfill the offer.

Do not reveal:
- shopping list contents;
- private recommendation profile;
- unrelated purchase history;
- sensitive attributes;
- unnecessary account identity.

The merchant may see campaign/offer status, validity, uses remaining, and other fulfillment information permitted by product policy.

## 22. Apple/Google Wallet as later extension

Later, eligible claimed Promo Passes may support:
- Add to Apple Wallet;
- Add to Google Wallet.

This is a convenience/export surface, not a replacement for Smart Shopper's server-side claim/redemption truth.

Wallet support is not required for V1.

## 23. V1 recommended scope

A practical first production version should prioritize:
- Save promotion;
- Saved Promos collection;
- Claim Offer;
- universal merchant codes;
- merchant-supplied unique code pools;
- Smart Shopper-issued QR Promo Pass for physical redemption;
- one-use and configurable multi-use limits;
- advertiser web scanner;
- server-authoritative atomic redemption;
- tracked outbound website/ticket links;
- claim/redemption analytics;
- verification-source labels;
- no Smart Shopper ticket/payment processing for advertiser goods/services.

Defer until justified:
- dynamic rotating QR;
- broad POS integrations;
- automated commerce-provider integrations;
- Apple/Google Wallet export;
- automated ROAS across many external platforms;
- Smart Shopper acting as merchant of record.

## 24. North Star boundary

> Smart Shopper should make promotions measurable by carrying the shopper from discovery through save, claim, and verifiable redemption where practical, while leaving the underlying purchase with the advertiser's existing commerce/ticketing system unless there is a deliberate future reason to take on more transaction responsibility.