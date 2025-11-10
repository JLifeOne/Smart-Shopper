# Smart Shopper — Universal Photo Ingestion & Paywall Enforcement (Spec)

**Scope:** Accept photos/screenshots and extract details for **Receipts**, **Hand‑written/typed Lists**, and **Menus/Recipes**. Route every asset to the correct parser automatically. Enforce **Premium paywalls** for Menu Ingestion without loopholes. Integrate with v0.2/0.3 features (Library, Lists, Receipts, Menu Premium, Pantry Lite/Restock) with zero regressions. Persist every Menu session as editable **Menu Cards** that users can reopen from Home or Lists.

---

## 1) Objectives

* **Universal intake:** Camera upload/import accepts photos and screenshots; robust OCR + layout analysis.
* **Auto‑classification:** Identify **Receipt** vs **List** vs **Menu** (and Unknown) with confidence score and rationale.
* **Accurate extraction:**
  * **Receipt:** store, date/time, subtotal, tax, discounts, **line items** (name, qty, size, unit, price), tenders.
  * **List:** clean list of items, cope with bullets/commas/multi‑column, handwriting, and screenshots.
  * **Menu (Premium):** dishes → canonical templates for Menu Ingestion; non‑premium flows do **not** bypass paywall.
* **Menu Cards lifecycle:** Auto-save every Menu parse as a *Menu Session* containing rotating dish cards, recipe methods, and math trail; users can reopen, smart-edit, and reapply scaling directly from Home “Recipes” rail and List detail.
* **Security:** All premium work executes server‑side behind **entitlement** checks; no client‑only gating. Menu artifacts stored server-side; mobile only fetches hashed card payloads pre-authorized per user.

---

## 2) Guardrails

* **Additive** schema only; no changes breaking existing queries.
* **Feature flags:** `ff_universal_ingest`, `ff_menu_ingestion_v1`, `ff_recipe_cards_home`.
* **Deterministic parsers** (pure functions) with unit tests and idempotent writes.
* **No paywall bypass:** server verifies entitlement **before** any menu template retrieval or scaling runs. Saved cards reference opaque IDs; no template hints for non-premium users.

---

## 3) User Flows

1. **Upload** (camera roll, files, in‑app camera). Multiple images allowed.
2. **Auto‑classify** asset → show chip: *Receipt* / *List* / *Menu* (with confidence). Allow user override if misclassified.
3. **Parse** according to class:
   * Receipt → quick review (store/date/lines) → Save to Receipts + PricePoints → Library refresh.
   * List → parsed tokens → category review → Add to List.
   * Menu (Premium): resolve dishes → clarify → compute → review → Add to List. Auto-create a **Menu Session** storing rotating dish cards (per category), recipes, and methods; sync session to user profile.
   * Menu (Non-Premium): show upsell + “Add dish names as plain list”; if user proceeds free path, create plain list artifact (no recipes) but still log classification.

**Edge:** Mixed batch (e.g., 1 receipt + 2 lists) → class/parse per image; merge results in a session summary. Menu sessions persist even if user leaves flow; resume from Home/List entry points.

---

## 4) Architecture

```
Client
 ├─ Capture UI (batch, crop, rotate, enhance)
 ├─ Classifier (on-device lite) → Server verify
 ├─ Receipt/List parsers (client or server)
 ├─ Menu pipeline UI (Premium only)
 ├─ Menu Card carousel (rotating dish cards per category)
 └─ Entitlement-aware actions + Saved Recipes rail (Home + Lists)

API
 ├─ /ingest/classify     (vision+text ensemble)
 ├─ /ingest/receipt      (layout + line items)
 ├─ /ingest/list         (tokenize + normalize)
 ├─ /ingest/menu         (PREMIUM: resolve/scale/merge/pack)
 ├─ /menu-sessions       (GET saved sessions, POST updates, PATCH cards)
 ├─ /menu-cards/:id      (GET hashed card payload, PUT smart edits)
 ├─ /entitlements        (user product, region)
 └─ Storage: image blobs (signed URLs), parse artifacts, Menu Sessions (cards, recipes, math trail)
```

**Why split endpoints?** Clear separation simplifies **paywall enforcement**, observability, and Menu Card persistence. `/menu-sessions` operates only after entitlement passes.

---

## 5) Classifier (Receipt vs List vs Menu vs Unknown)

**Model:** Light image–text ensemble (fast path on device, authoritative on server):

* **Visual cues**: thermal receipt layout (narrow, long strip, monospaced), bullet/checkbox shapes, menu typography, price columns, illustrated dishes.
* **Text features**: presence of `SUBTOTAL/TAX/TOTAL`, currency patterns, date/times; list separators (`•`, `-`, commas, newlines) vs culinary verbs and dish templates (“Brown Stew Chicken” + ingredients).

**Output:** `{class: 'receipt'|'list'|'menu'|'unknown', confidence: 0..1, reasons[]}`

**Thresholds:**

* `≥0.75` → auto route.
* `0.4–0.75` → prompt user to confirm.
* `<0.4` → Unknown → manual choice (still logs reasons for tuning).

Classifier logs include reasons and preview thumbnails for ML tuning + UX explanations.

---

## 6) OCR & Layout

* **OCR stack:** On-device ML Kit → server fallback (Tesseract/Cloud Vision). Languages: English + Jamaican patois variants; extendable to es-MX/fr-CA later.
* **Layout analysis:** DocTR/LayoutLM-style blocks → lines → columns. Receipts: detect **right-aligned price column** + left description. Lists: detect bullet/checkbox zones + multi-column grids via X clustering. Menus: detect multi-column price combos, sections (“Starters”, “Mains”), or photo cards.
* **Handwriting:** ML Kit handwriting model; post-OCR spell correction with **Library aliases** and Menu template dictionary.

---

## 7) Parsers

### 7.1 Receipt Parser (idempotent)

* **Store**: regexes + store logo/text priors; geocode hints if EXIF present.
* **Date/Time**: multi-format regex; pick highest confidence; apply timezone.
* **Lines**: segment `name`, `qty`, `size+unit`, `price`, `discount`; handle multi-row descriptions and coupons.
* **Totals**: SUBTOTAL/TAX/TOTAL; consistency check vs sum(lines) ± rounding.
* **Fingerprint**: SHA256 of normalized store+datetime+line tuple prevents duplicates independent of image hash.
* **Output** → `Receipt`, `PricePoint[]` (brand_id nullable), artifacts for review.

### 7.2 List Parser

* **Tokenization**: split by newlines, commas, semicolons, `•`, `●`, dashes; trim; drop empties.
* **Normalize**: dedupe, casing, map to Library aliases, categorize → `ListItem[]`.
* **Evidence**: keep raw text & token map for review/resume.

### 7.3 Menu Parser (Premium only)

* **Dishes**: identify dish names; map via `RecipeAlias`/templates; ambiguity prompts (cake mix vs scratch).
* **Compute**: call Menu engines (scaling, merge, pack rounding, math trail) defined in v0.3. Output includes per-dish method steps + ingredient groups.
* **Card orchestration**:
  * Build **rotating floating cards** per dish with hero photo/emoji, category tag (Starter, Main, Dessert, etc.), portion/appetite chips, ingredient summary, CTA “Add to List” / “Smart Edit”.
  * Cards auto-rotate within the Menu review screen; user can pin or reorder.
* **Smart edit/adjust**: inline controls to tweak servings, substitute ingredients, toggle cooking method; edits patch server card and recompute math trail.
* **Gating**: server checks entitlement **before** template access; otherwise 402 with metadata for upsell. Free fallback returns only plain dish titles (no ingredient/method data) and does **not** create Menu Session.

### 7.4 Menu Session Persistence

* **Session record**: `menu_session_id`, `user_id`, `created_at`, `source_artifact_id`, `title`, `tags`, `context` (occasion, appetite), `card_ids[]`.
* **Card record**: `menu_card_id`, `dish_name`, `category`, `rotation_index`, `portion_info`, `ingredient_breakdown`, `method_steps`, `math_trail`, `last_edited_by`, `last_viewed_at`.
* **Auto-save**: sessions sync after each parser stage and after edits; offline queue persists updates until online.
* **Access**: `/menu-sessions` returns paged list; cards can be reopened from:
  * **Home → Recipes rail** (placed directly under the hero stats, ahead of promos).
  * **Lists tab**: “Recipes & Menus” pill near Library/New List buttons; tapping opens the rotating card canvas for quick add.
* **Deletion**: soft delete with undo; 30-day retention for server cleanup.

---

## 8) Paywall & Anti‑Circumvention

* **Server-side entitlements**: `/ingest/menu` and `/menu-sessions` require `entitlement.premium==true`. Failure → 402 with upsell metadata.
* **Opaque artifacts**: templates/methods never sent before entitlement success; hashed IDs used in client references; tampering invalidates signature.
* **Rate limiting**: per user/IP for premium endpoints (default 60/min burst, 500/day).
* **Event metering**: `menu_parses/month` and `menu_card_edits/month` per plan; enforced server-side.
* **Client UX**: Menu detected for non-premium surfaces lock screen, CTA “Try Premium” and secondary “Add dish titles only”. If user picks free path, server stops before templates and stores that choice.

---

## 9) Data Contracts (summaries)

* `POST /ingest/classify {imageUrl}` → `{class, confidence, reasons[], artifactId}`
* `POST /ingest/receipt {artifactId}` → `{store, date, lines[], totals, artifactId}`
* `POST /ingest/list {artifactId}` → `{items[], artifactId}`
* `POST /ingest/menu {artifactId, people, appetite, context}` (Premium) → `{menuSessionId, dishes[], needs[], listItems[], mathTrail, cards[]}`
* `GET /menu-sessions?cursor=` → `{sessions: [{menuSessionId, title, tags, lastUpdated, previewCardIds[]}]}`
* `GET /menu-cards/:id` → `{menuCardId, dishName, category, rotationIndex, portionInfo, ingredients[], methodSteps[], mathTrail}`
* `PATCH /menu-cards/:id {edits}` → updated card payload + recomputed needs/list deltas.

All returns include `artifactId` for traceability and re-render in review screens.

---

## 10) UX States

* **Classified badge** on preview card; tap to change.
* **Home screen**: 
  * Add **Recipes rail** under hero KPIs, showing up to 3 rotating Menu Cards (auto-scroll). CTA: “Open Recipe Hub”.
  * Keep Suggested Additions + Next Actions below Recipes to keep cards near top per request.
* **Lists tab**:
  * Add “Recipes & Menus” pill next to `Library` / `New list` buttons. Opens the Menu Card canvas filtered to grocery context.
  * Within a list, show “Attach Menu Session” action; attaches cards and logs references.
* **Review screens**:
  * Receipt: compact table with auto-fix chips (unit/brand), confidence badges, photo strip.
  * List: tokens with category chips, batch edit, “Add all”.
  * Menu: **Menu Card carousel** (rotating floating cards), portion/appetite chips, explainable math trail. Each card includes “Smart Edit” and “Save as Recipe” toggles; editing updates the session.
* **Saved Menu Hub**:
  * Grid of cards grouped by category (Breakfast, Dinner, Dessert). Long press to pin. Cards animate rotate-on-hover (auto every 6s).
  * Detail view shows ingredients, methods, conversion controls, Add to List CTA, and history of edits.
* **Non‑Premium Menu**: lock icon, short explainer, CTA: *Try Premium* or *Add dish names only*. Recipes rail displays locked placeholders if user not premium.

---

## 11) Accuracy & Quality Gates

* **Receipt line item recall** ≥ 93% on clear photos; store/date accuracy ≥ 97%.
* **List token F1** ≥ 0.95 on synthetic & real handwriting sets.
* **Menu resolution** ≥ 90% template match on seeded dishes; smart-edit recompute within 500 ms server SLA.
* **Classifier confusion** < 5% between Receipt/List; < 8% Menu vs List.
* **Menu Card sync**: 99% success across mobile ↔ server; conflict resolution merges last edit + prompts user.
* **Human-in-loop**: review UIs allow one-tap corrections; corrections update alias/templates.

---

## 12) Testing Plan

**Unit tests**

* Classifier feature extraction, tokenization (`/\n|,|;|•|●/g`), brand/size regexes, currency/date parsers.
* Deterministic Menu engines: scaling, merge, pack rounding, math trail, smart-edit diffing.
* Menu session reducers (add/edit/pin/rotate) guaranteeing idempotent writes.

**Integration tests**

* Full receipt images (various stores), multi-page and crumpled; discount lines; multi-currency.
* Handwritten lists with bullets/columns; screenshots of notes app.
* Menu screenshots & photos; lock enforcement for non-premium; saved card reopen.
* Offline scenario: capture menu, edit card offline, sync once online (no duplicate math trails).

**E2E**

* Offline upload queue; conflict resolution; artifact review → save; Library & Heatmap updates.
* Paywall: tampered client requests to `/ingest/menu` or `/menu-sessions` rejected server-side.
* Home/List entry to Recipe Hub: ensure rail displays latest sessions, editing card updates list attachments.

**Datasets**

* Seed internal set (≥200 receipts, ≥100 lists, ≥80 menus) + synthetic renders (fonts/lighting). 
* Menu dataset includes multi-column menus, QR code menus, photos of chalkboards, typed tasting menus.

---

## 13) Telemetry

* `ingest_classified{class,confidence}`
* `receipt_parse_success{line_count, corrections}`
* `list_parse_success{item_count}`
* `menu_parse_success{dish_count, edit_count}`
* `menu_card_saved{session_id, card_id, category}`
* `menu_detect_nonpremium` + upsell CTR, conversions
* `recipe_rail_interaction{entry_point:home|lists, action:view|open|attach}`
* Error buckets with sample artifacts (redacted) for triage.

---

## 14) Privacy & Security

* User consent screen for images; redact PII (loyalty IDs, card tails) before storage.
* Signed URLs; 30-day retention for raw images (configurable); artifacts keep only derived text.
* Menu Sessions stored server-side with RLS keyed by user; hashed card IDs on client.
* Audit logs for premium endpoints + menu session edits; diffusion-limited share tokens for when sessions are shared.

---

## 15) Rollout

1. **Internal**: classifier + receipt/list parsers; menu endpoint + sessions behind admin flag.
2. **Beta**: enable `ff_universal_ingest` + `ff_recipe_cards_home` for 5% premium cohort; monitor accuracy, paywall events, session sync.
3. **GA**: enable for all; Recipes rail visible to everyone (non-premium sees locked cards), Menu parser only for paid users.

---

## 16) Risks & Mitigations

* **Handwriting variability** → user correction UI + alias learning.
* **Classifier confusion** → manual override; store reasons for tuning; Home/List rails show fallback state if classification uncertain.
* **Paywall exploits** → server-only templates; entitlement checks before work; rate limits; signed artifact IDs.
* **Performance** → on-device OCR first; resize to 1600px longest side; streaming uploads; background parsing; card rotation uses lightweight Lottie animations (<40 kb).
* **Card clutter** → grouping by category + pinning; limit rail to pinned or most recent 6.

---

## 17) Open Questions

* Regions/language priorities for OCR beyond English/patois? (es‑MX, fr‑CA?).
* Minimum device spec for on-device handwriting + animations; fallback path for low-end devices (static cards?).
* Menu upsell copy, pricing tiers, and monthly session quota? E.g., 30 menu parses/month for Premium.
* Sharing Menu Sessions externally? (Future: share link + view-only card deck.)
* Should Recipe rail highlight crowdsourced/public menus or remain strictly personal?

— End —
