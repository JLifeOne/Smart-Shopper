# Shopping List App — Product Requirements Document (Unified)

**App:** Smart Shopper  
**Version:** v0.2 (Unified from v0.1 + Item Library/Mock features)  
**Owner:** J Law  
**Audience:** Product, Design, Engineering, Data  
**Status:** Ready for Build

---

## Changelog

* **v0.2 (this doc):** Merges v0.1 PRD with all Item Library upgrades that were previously prototyped (Pinned/Recent tabs, Add to Existing List picker, unit-price + price memory, badges, bundle creation, receipt intelligence that trains library, manual item add, quick-add from search w/ toast + floating + button, budget mode, compare sheet, trend chips, heatmap overlay, share/export, offline banner, barcode/receipt stubs, pantry/restock placeholders) and locks them in as production requirements. Clarifies Jamaica locale defaults (JMD, g/L) and adds acceptance criteria for Library behaviors.
* **v0.1:** Initial PRD (goals, personas, receipt OCR, unit-price normalization, store compare, heatmap, alerts, contributions, offline-first, data model, roadmap, etc.).

---

## 0) Quick Upgrade Ideas (beyond the notebook notes)

* **Unit-price normalization** (compare per 100g/oz/L even when pack sizes differ).
* **Barcode scan** (EAN/UPC) + **receipt OCR** with line-item parsing & tax/discount handling.
* **Crowdsourced price updates** with lightweight verification (photo proof + trust score).
* **Price alerts** (notify when an item drops below your target or historical average).
* **Pantry inventory** with **restock predictions** (based on last purchase + consumption rate).
* **Smart list builder** (auto-suggest staples you’re likely low on; one-tap add).
* **Store switcher w/ geofencing** (auto-sort list by aisle/store; detect nearby stores).
* **Budget mode** (shows running total + tax; green/yellow/red against a budget).
* **Meal plan hooks** (optional: build a meal → generate list; match substitutions by unit price).
* **Deals & coupons feed** (match to your list; highlight true savings after unit-price).
* **Heatmap calendar** (spend, savings, and price volatility per day/week).
* **List sharing** (family/couple mode; real-time check-offs; per-member assignments).
* **Offline first** (queue scans/edits; sync when online).
* **Gamified contributions** (badges/points for verified price submissions; anti-spam checks).
* **Data export** (CSV/PDF of spend, store comparisons).

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

* Full meal-planning engine, coupon scraping at scale, or bank account linking.
* Cross-border taxes/shipping logic.

---

## 3) Personas

* **Solo Saver:** Budget-aware shopper comparing core staples weekly.
* **Family Coordinator:** Shares list, tracks pantry & restock; cares about total trip cost.
* **Deal Hunter:** Wants alerts on drops vs historical average; contributes prices.

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

### 5.1 Item Library (global, bottom-nav right tab)

* **Alphabetical master list** of every item ever added by the user; **A–Z jump rail**.
* **Header layout:** global header houses the search input (right of the screen title/controls) so Library search is always visible without scrolling.
* **Tabs:** All, **Pinned**, **Recent**, **Bundles**.
* **Sort:** A–Z / Last used / Most used. **Filter:** by category.
* **Pinned items:** tap star to pin/unpin; undo via toast (graceful mis-tap recovery).
* **Recent:** top N by recency.
* **Badges/Chips per item:** category, **last store**, **last unit price + unit**, **trend chip** (▲/▼/•), **cheapest-store chip** (color-coded; see §5.3).
* **Search with quick-add:** header search bars support quick-add; if no results, show **toast** with actions: **Add to Library** or **Add & Add to List**; also show floating **+** to one-tap add.
* **Add to Existing List picker:** choose **New List (draft)** or existing lists.
* **Bundles:** create from multiselect; bundle cards show items and usage; "Add to List" CTA.
* **Manual add:** name + category; adds immediately to Library.
* **Receipt intelligence training:** confirming parsed receipt lines updates Library (store, unit price, usage, recency).
* **Offline-first visuals:** optional banner indicating queued changes when offline.

### 5.2 List Input & Parsing

* **Input methods:** manual text, checklist builder, **voice → text**, **photo** of handwritten/typed list.
* **OCR stack:** on-device (ML Kit) → fallback cloud OCR; detect lines; spell-correct to catalog/aliases.
* **Categorization:** model + rules; user can re-tag; **learns from corrections** (per-user profile).

### 5.3 Store & Price Tracking

* Maintain **per-store catalogs** with synonyms (e.g., "Heinz Tomato Ketchup 567g" vs "Ketchup Heinz 20oz").
* **Unit-price normalization:** compare **price_per_base_unit** (e.g., JMD per 100g/oz/L). Jamaica default base units: **g**/**L** (toggle to oz/fl oz per user preference).
* **Min/Max highlighting (cheapest chip):**

  * **Green:** current store is **cheapest** (≤ baseline_min).
  * **Yellow:** within **5%** of cheapest.
  * **Red:** ≥ **10%** higher than cheapest.
  * **Gray:** insufficient data.
* **Trend chip** on each item: ▲ (up X%) ▼ (down Y%) • (flat), window = last N weeks.
* **Store compare sheet**: rows show **Store — Latest price — Unit price — Last updated — Source — Trust%**; cheapest pinned.

### 5.4 Receipt Ingestion

* **Capture:** camera (multi-page), PDF/image import.
* **Parsing:** detect store name, date, subtotal, tax, discounts, and each line item (name, qty, size, unit).
* **Validation UI:** quick confirm screen; tap to fix item or unit; **training updates** Library + price history.
* **Storage:** item-level record with **store_id**, **timestamp**, **price**, **size/unit**, **discount_applied**.

### 5.5 Calendar Heatmap (Insights)

* Default view: **spend** per day (intensity = total JMD).
* Toggle layers: **savings vs historical avg**, **# items below average**, **price change count** (volatility).
* Tap a day → detail sheet: stores visited, items, biggest movers, total saved vs baseline.

### 5.6 Lists, Sharing & Non-Food Support

* Multiple lists (Groceries, Hardware, Pharmacy).
* **Share list** (invite link) with real-time check-offs; per-assignee items.
* Category set includes household, personal care, pets, baby, auto, etc.

### 5.7 Budget & Trip Summary (MVP-Plus)

* Running **cart total** (pick a store → shows est. total using latest prices).
* **Budget bar** with thresholds (green/yellow/red); shows % of budget used.

### 5.8 Price Alerts (Post-MVP)

* Per item: **target price** or **% drop vs 30-day avg**.
* Push/email notifications.

### 5.9 Contributions & Trust (Post-MVP)

* Submit price w/ optional **shelf photo**; **trust score** rises with verified matches.
* Outlier detection and flagging.

### 5.10 Deals & Meal Planning (Hooks; Post-MVP)

* **Deals & coupons feed** matched to Library/List items; highlight true savings after normalization.
* **Meal plan → list**: generate list from meals; suggest **substitutions** by unit price.

### 5.11 Offline-First

* Local cache for lists, last prices, catalogs; **background sync** when online; queue edits; show status banner.

---

## 6) Flows (Happy Paths)

1. **Create list → Add items** (voice/photo/text) → Review parse → Save.
2. **After shopping** → Scan receipt → Quick validate → Prices update → Heatmap & trends refresh.
3. **Pick store** before trip → See **cheapest per item** & **trip total** → Shop.
4. **Search Library** → none found → **Add** or **Add & Add to List** → (optional) open picker → list updated.
5. **Select multiple** in Library → **Create bundle** → Add bundle to list later.

---

## 7) Data Model (high-level)

* **User**(id, name, locale, currency, prefs)
* **Store**(id, name, address, geo, brand)
* **Product**(id, brand, name, category, size_value, size_unit, barcode?)
* **ProductAlias**(product_id, raw_name, store_id)
* **PricePoint**(id, product_id, store_id, price, currency, timestamp, source: receipt|user|import, discount)
* **List**(id, user_id, name, shared_flag)
* **ListItem**(id, list_id, product_id, desired_qty, substitutions_ok, notes)
* **Inventory**(user_id, product_id, qty_on_hand, last_purchase_at, est_days_left)
* **Alert**(user_id, product_id, rule_type, threshold)

*Derived:* **price_per_base_unit**, **trend_30d**, **cheapest_store_id** per product.

---

## 8) Algorithms (essentials)

* **Normalization:** `price_per_base_unit = price / convert(size_value, size_unit → base_unit)`; base unit per category (e.g., g or ml). Jamaica default: **g**/**L**; show per 100g where applicable.
* **Cheapest store:** latest valid `price_per_base_unit` in lookback window (e.g., 60–90 days) excluding stale/outliers.
* **Trend:** compare last price to moving average; compute % change; map to ▲/▼/•.
* **Receipt product match:** fuzzy match (token set ratio) + store-specific alias table → top candidate above threshold; otherwise prompt user.

---

## 9) Acceptance Criteria (MVP)

* Uploading a **handwritten list photo** extracts ≥90% of clearly written items with editable review.
* Receipt scan creates **item-level price records** with correct store/date ≥95% of the time (clear receipts).
* Item detail shows **price history** and **store comparison** with unit-price normalization.
* Heatmap calendar renders without noticeable lag; tap shows day details.
* Non-food items can be added and behave identically to food items.
* **Library quick-add**: when a search yields no results, a toast appears with both **Add** and **Add & Add to List** actions; floating **+** is visible.
* **Pinned/Recent** tabs function as described; pin/unpin provides **Undo** window.
* **Bundles** can be created from multiselect and listed under the **Bundles** tab.

---

## 10) Analytics & Success Metrics

* % of lists created via photo/voice vs text.
* Receipt scans per user per month.
* Items with 2+ price points (data coverage).
* Avg savings per trip vs user’s baseline store.
* Alert opt-ins and click-through (post-MVP).
* Library engagement: quick-add conversions, bundle creations, pin usage.

---

## 11) Tech Notes / Stack (suggested)

* **App:** React Native (Expo) or Flutter; offline storage (SQLite/WatermelonDB).
* **OCR:** Google ML Kit on-device; Cloud Vision/Tesseract fallback.
* **Backend:** Firebase (Auth, Firestore, Cloud Functions, Storage) **or** Supabase/Postgres (Prisma).
* **Search/fuzzy match:** mini index per store; server function for alias resolution.
* **Privacy:** images stored with user consent; PII minimized; delete/export self-service.

---

## 12) Risks & Mitigations

* **Messy receipts / alias hell:** human-in-the-loop correction + alias tables + learn from edits.
* **Comparing non-equivalent sizes:** strict unit normalization + category base units + warning banners.
* **Data sparsity by store:** accept crowdsourced updates with trust scoring and moderation.

---

## 13) Roadmap (Phases)

* **Phase A (MVP Core):** list capture (text/voice/photo), basic parse & edit, receipt scan with item-level prices, unit normalization, cheapest store highlighting, price history, heatmap calendar, Item Library MVP (search, pin, recent, manual add).
* **Phase B (MVP-Plus):** budget/estimate total by store, list sharing, offline-first polish, bundles.
* **Phase C (Growth):** price alerts, contributions + trust, pantry inventory & restock, deals/coupons matching, geofenced store switcher, meal-plan hooks.

---

## 14) Monetization (options)

* Free app → **Pro** (alerts, pantry restock predictions, data export, advanced insights).
* Affiliate or partner SKUs (opt-in).
* B2B portal for stores to push verified prices (flagged as sponsored).

---

## 15) Open Questions

1. Compare **prices with or without tax** by default? (set per region; show toggle)
2. Preferred **base units** by category (g vs oz, ml vs fl oz) for Jamaica vs other locales?
3. What stores to seed first? (e.g., by parish/city)
4. Minimum lookback window for “cheapest” (avoid stale specials)?
5. Verification strictness for crowdsourced prices (photo required or optional)?
6. Should **Pantry** be a full inventory with on-hand counts at MVP, or introduced in Phase C only?

---

## 16) UX Notes (MVP)

* **Item row**: name • size • last price • **trend chip** • **cheapest store chip** (color coded).
* **Store compare sheet**: [Store] — [Latest price] — [Unit price] — [Last updated] — [Source] — [Trust%]; cheapest pinned.
* **Detail screen**: sparkline of price history; button to set alert target; receipt thumb gallery.
* **Calendar heatmap**: toggle chips for Spend / Savings / Volatility; tap reveals daily detail.
* **Library search (no results)**: black toast with **Add** / **Add & Add to List**; floating **+** button.
* **Add to… picker**: New List (Draft) or existing; confirmation updates draft counter.

---

## 17) Definitions

* **Unit price** = price normalized to base unit (e.g., per 100g or per L).
* **Volatility** = count of items whose price moved >X% week-over-week.
* **Baseline** = user’s most frequent store unless overridden.

---

## 18) Backlog Items Discussed (Not Yet Implemented / Not in v0.2 Scope)

1. **Heatmap Calendar V2** — wire to real aggregates, swipeable month nav, rich day-detail modal with holidays/events.
2. **Theme Selection** — palette definitions, settings UI, persistence across devices, dynamic styling.
3. **Inventory View** — dedicated tab with aggregated receipts, sorting/filtering, CSV export pipeline.
4. **Analytics Expansion** — item-level price history charts, “top spend” insights, deeper analytics cards.
5. **Rich List Entry Parsing** — enhanced parser (quantity/unit/price/store inference) backed by service.
6. **List Sharing Flow** — share CTA, short-link landing, edge function for invite & app-store handoff.
7. **Home Scroll & Performance Polish** — smooth scroll, memoized sections, interaction tuning per design spec.
8. **Design Spec Polish Items** — remaining UI components/micro-interactions per design spec.

---

*End of Unified PRD v0.2*
