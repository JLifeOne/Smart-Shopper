# Smart Shopper Promos Marketplace PWA Prototype

This is an isolated, branch-only interaction prototype for the Promos Marketplace feature.

## Purpose

Validate the product and UX before wiring production data, payments, moderation, or personalization into the existing Expo/Supabase application.

## Prototype modes

- Shopper
  - Home Promo Spotlight
  - category-based Promos feed
  - Like / Save / Share
  - Promo Detail
  - Not interested / report simulation
- Advertiser
  - dashboard
  - campaign metrics
  - reusable campaigns
  - create-campaign flow
  - Premium entitlement + pay-as-you-go price summary
  - payment-at-submit simulation
- Admin
  - moderation queue
  - approve / request changes / reject + refund simulation
  - campaign slot/inventory summary
  - system safety controls

## Important boundaries

- No production payment provider is connected.
- No real moderation authorization exists in this prototype.
- No real shopper targeting or private user data is used.
- State is local to the browser and can be reset.
- This prototype must not be merged into `main` as production code without a separate integration review.

## Branch preview

Cloudflare Pages project: `smart-shopper-promos-preview`

Deployment source: `feature/promos-marketplace` only, rooted at `prototype/promos-marketplace`.

The Pages project is intentionally separate from any production Smart Shopper deployment so prototype changes cannot alter `main` or production application behavior.

## Local serving

The prototype is static and can be served from this directory with any static web server.

Example:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Source of truth

Read before changing the prototype:

1. `docs/features/promos-marketplace/README.md`
2. `docs/features/promos-marketplace/DESIGN-SPEC.md`
3. `docs/features/promos-marketplace/DECISIONS.md`
4. `docs/features/promos-marketplace/FAILURE-LOG.md`

Any meaningful failure discovered while building/testing must be appended to the failure log. Do not delete old entries.
