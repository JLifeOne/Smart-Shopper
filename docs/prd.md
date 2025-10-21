# Shopping List App — Product Requirements Document (PRD)

**Version:** 0.1  
**Owner:** J Law  
**Audience:** Product, Design, Engineering, Data  
**Status:** Draft

---

## 0) Quick Upgrade Ideas (beyond the notebook notes)

- **Unit-price normalization** (compare per 100g/oz/L even when pack sizes differ).
- **Barcode scan** (EAN/UPC) + **receipt OCR** with line-item parsing & tax/discount handling.
- **Crowdsourced price updates** with lightweight verification (photo proof + trust score).
- **Price alerts** (notify when an item drops below your target or historical average).
- **Pantry inventory** with **restock predictions** (based on last purchase + consumption rate).
- **Smart list builder** (auto-suggest staples you’re likely low on; one-tap add).
- **Store switcher w/ geofencing** (auto-sort list by aisle/store; detect nearby stores).
- **Budget mode** (shows running total + tax; green/yellow/red against a budget).
- **Meal plan hooks** (optional: build a meal → generate list; match substitutions by price per unit).
- **Deals & coupons feed** (match to your list; highlight true savings after unit-price).
- **Heatmap calendar** (spend, savings, and price volatility per day/week).
- **List sharing** (family/couple mode; real-time check-offs; per-member assignments).
- **Offline first** (queue scans/edits; sync when online).
- **Gamified contributions** (badges/points for verified price submissions; anti-spam checks).
- **Data export** (CSV/PDF of spend, store comparisons).

---

## 1) Problem & Opportunity

Groceries and household items fluctuate in price across stores and time. Shoppers waste money and time because they can’t easily: (a) capture a list any way they want (voice/photo/text), (b) know **which store is cheapest today per item** normalized by unit, and (c) track **price history** with useful alerts. This app makes saving money effortless.

---

## 2) Goals (MVP)

1. Capture a shopping list via **text, voice, or photo**.
2. **Parse** items into categories; correct quickly when wrong.
3. **Ingest receipts** and store **item-level prices** by **store** and **date**.
4. Show **cheapest store per item** (with color codes) and **price history** (rises/falls).
5. Provide a **heatmap calendar** of spending and price volatility.
6. App works for **food and non-food** items.

### Non-Goals (MVP)

- Full meal-planning engine, coupon scraping at scale, or bank account linking.
- Cross-border taxes/shipping logic.

---

## 3) Personas

- **Solo Saver**: Budget-aware shopper comparing core staples weekly.
- **Family Coordinator**: Shares list, tracks pantry & restock; cares about total trip cost.
- **Deal Hunter**: Wants alerts on drops vs historical average; contributes prices.

---

## 4) User Stories (MVP)

1. *As a user*, I can **dictate** or **snap a photo** of a handwritten list; the app extracts items.
2. *As a user*, I can **scan a receipt**; the app saves item, unit size, price, store, date, discounts.
3. *As a user*, I can **see which store is cheapest per item** normalized by unit (e.g., per 100g).
4. *As a user*, I can **see price history** for any item by store and **get a rise/fall indicator**.
5. *As a user*, I can view a **calendar heatmap** showing spend, savings, and volatility.
6. *As a user*, I can track **non-food items** (e.g., detergent, batteries) the same way.

---

## 5) Key Features & Requirements

### 5.1 List Input & Parsing

- **Input methods:** manual text, checklist builder, voice → text, photo of handwritten/typed list.
- **OCR stack:** on-device (ML Kit) → fallback cloud OCR; detect lines; spell-correct to catalog.
- **Categorization:** model + rules; user can re-tag; learns from corrections (per-user profile).

### 5.2 Receipt Ingestion

- **Capture:** camera (multi-page), PDF/image import.
- **Parsing:** detect store name, date, subtotal, tax, discounts, and each line item (name, qty, size, unit).
- **Validation UI:** quick confirm screen; tap to fix item or unit.
- **Storage:** item-level record with **store_id**, **timestamp**, **price**, **size/unit**, **discount_applied**.

### 5.3 Store & Price Tracking

- Maintain **per-store catalogs** with synonyms (e.g., "Ketchup Heinz 20oz", "Heinz Tomato Ketchup 567g").
- **Unit-price normalization:** compare **price_per_base_unit** (e.g., JMD per 100g/oz/L).
- **Min/Max highlighting:**
  - **Green:** current store is **cheapest** (≤ baseline_min).
  - **Yellow:** within **5%** of cheapest.
  - **Red:** ≥ **10%** higher than cheapest.
  - **Gray:** insufficient data.
- **Trend chip** on each item: ▲ (up X%) ▼ (down Y%) • (flat), window = last N weeks.

### 5.4 Calendar Heatmap

- Default view: **spend** per day (intensity = total JMD).
- Toggle layers: **savings vs historical avg**, **# items below average**, **price change count**.
- Tap a day → detail sheet: stores visited, items, biggest movers, total saved vs baseline.

### 5.5 Lists, Sharing & Non-Food Support

- Multiple lists (Groceries, Hardware, Pharmacy).
- **Share** list (invite link) with real-time check-offs; per-assignee items.
- Category set includes household, personal care, pets, baby, auto, etc.

### 5.6 Budget & Trip Summary (MVP-Plus)

- Running **cart total** (pick a store → shows est. total using latest prices).
- **Budget bar** with thresholds.

### 5.7 Price Alerts (Post-MVP)

- Per item: **target price** or **% drop vs 30-day avg**.
- Push/email notifications.

### 5.8 Contributions & Trust (Post-MVP)

- Submit price w/ optional shelf photo; **trust score** rises with verified matches.
- Outlier detection and flagging.

### 5.9 Offline-First

- Local cache for lists, last prices, catalogs; background sync when online.

---

## 6) Flows (Happy Paths)

1. **Create list → Add items** (voice/photo/text) → Review parse → Save.
2. **After shopping** → Scan receipt → Quick validate → Prices update → Heatmap & trends refresh.
3. **Pick store** before trip → See **cheapest per item** & **trip total** → Shop.

---

## 7) Data Model (high-level)

- **User**(id, name, locale, currency, prefs)
- **Store**(id, name, address, geo, brand)
- **Product**(id, brand, name, category, size_value, size_unit, barcode?)
- **ProductAlias**(product_id, raw_name, store_id)
- **PricePoint**(id, product_id, store_id, price, currency, timestamp, source: receipt|user|import, discount)
- **List**(id, user_id, name, shared_flag)
- **ListItem**(id, list_id, product_id, desired_qty, substitutions_ok, notes)
- **Inventory**(user_id, product_id, qty_on_hand, last_purchase_at, est_days_left)
- **Alert**(user_id, product_id, rule_type, threshold)

Derived fields: **price_per_base_unit**, **trend_30d**, **cheapest_store_id** per product.

---

## 8) Algorithms (essentials)

- **Normalization:** `price_per_base_unit = price / convert(size_value,size_unit → base_unit)`; base unit per category (e.g., g or ml).
- **Cheapest store:** latest valid `price_per_base_unit` in lookback window (e.g., 60–90 days) excluding stale/outliers.
- **Trend:** compare last price to moving average; compute % change.
- **Receipt product match:** fuzzy match (token set ratio) + store-specific alias table → top candidate above threshold; otherwise prompt.

---

## 9) Acceptance Criteria (MVP)

- Uploading a **handwritten list photo** extracts ≥90% of clearly written items with editable review.
- Receipt scan creates **item-level price records** with correct store/date ≥95% of the time (clear receipts).
- Item detail shows **price history** and **store comparison** with unit-price normalization.
- Heatmap calendar renders without lag; tap shows day details.
- Non-food items can be added and behave identically to food items.

---

## 10) Analytics & Success Metrics

- % of lists created via photo/voice vs text.
- Receipt scans per user per month.
- Items with 2+ price points (data coverage).
- Avg savings per trip vs user’s baseline store.
- Alert opt-ins and click-through (post-MVP).

---

## 11) Tech Notes / Stack (suggested)

- **App:** React Native (Expo) or Flutter; offline storage (SQLite/WatermelonDB).
- **OCR:** Google ML Kit on-device; Cloud Vision/Tesseract fallback.
- **Backend:** Firebase (Auth, Firestore, Cloud Functions, Storage) **or** Supabase/Postgres (Prisma).
- **Search/fuzzy match:** mini index per store; server function for alias resolution.
- **Privacy:** images stored with user consent; PII minimized; delete export self-service.

---

## 12) Risks & Mitigations

- **Messy receipts / alias hell:** human-in-the-loop correction + alias tables + learn from edits.
- **Comparing non-equivalent sizes:** strict unit normalization + category base units + warning banners.
- **Data sparsity by store:** accept crowdsourced updates with trust scoring and moderation.

---

## 13) Roadmap (Phases)

- **Phase A (MVP Core):** list capture (text/voice/photo), basic parse & edit, receipt scan with item-level prices, unit normalization, cheapest store highlighting, price history, heatmap calendar.
- **Phase B (MVP-Plus):** budget/estimate total by store, list sharing, offline-first polish.
- **Phase C (Growth):** price alerts, contributions + trust, pantry inventory & restock, deals/coupons matching, geofenced store switcher.

---

## 14) Monetization (options)

- Free app → **Pro** (alerts, pantry restock predictions, data export).
- Affiliate or partner SKUs (opt-in).
- B2B portal for stores to push verified prices (flagged as sponsored).

---

## 15) Open Questions

1. Compare **prices with or without tax** by default? (set per region; show toggle)
2. Preferred **base units** by category (g vs oz, ml vs fl oz) for Jamaica vs other locales?
3. What stores to seed first? (e.g., by parish/city)
4. Minimum lookback window for “cheapest” (avoid stale specials)?
5. How strict should verification be for crowdsourced prices (photo required or optional)?

---

## 16) UX Notes (MVP)

- **Item row**: name • size • last price • trend chip • cheapest store chip (color coded).
- **Store compare sheet**: [Store] — [Latest price] — [Unit price] — [Last updated]; cheapest pinned.
- **Detail screen**: sparkline of price history; button to set alert target; receipt thumb gallery.
- **Calendar heatmap**: toggle chips for Spend / Savings / Volatility.

---

## 17) Definitions

- **Unit price** = price normalized to base unit (e.g., per 100g).
- **Volatility** = count of items whose price moved >X% week-over-week.
- **Baseline** = user’s most frequent store unless overridden.

---

## 18) Backlog Items Discussed (Not Yet Implemented / Not in PRD Scope)

1. **Heatmap Calendar V2** — wire to real Supabase aggregates, swipeable month navigation, and rich day-detail modal with holidays/events.
2. **Theme Selection** — palette definitions, settings UI, persistence across devices, and dynamic styling of nav/cards/heatmap intensity.
3. **Inventory View** — dedicated tab with aggregated receipts, sorting/filtering, and future CSV export pipeline.
4. **Analytics Expansion** — item-level price history charts, “top spend” insights, and deeper analytics cards on home + item detail screens.
5. **Rich List Entry Parsing** — enhanced parser (quantity/unit/price/store inference) backed by the new Python service and hooked into list creation.
6. **List Sharing Flow** — share CTA, short-link landing page, and Supabase edge function for invite & app-store handoff.
7. **Home Scroll & Performance Polish** — smooth scroll behavior, memoized sections, and interaction tuning per the design spec.
8. **Design Spec Polish Items** — remaining UI components, tokens, and microinteraction polish outlined in the design spec but not yet delivered.

---

*End of PRD v0.1*
