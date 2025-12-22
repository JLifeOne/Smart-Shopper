# Menus Production Rollout Plan

## Stage 1 – Data & API Foundations (current work)

1. **Schema & migrations**
   - `menu_recipes` – persisted cards (title, course, cuisine_style, servings JSON, ingredients JSONB, method JSONB, tips, packaging_notes, owner_id, premium flag, timestamps).
   - `menu_sessions` + `menu_session_items` – draft uploads plus OCR items (raw text, boxes, classifier tags, confidence).
   - `menu_combos` – saved pairings (title, description, dish_ids[], locale, owner_id, timestamps).
   - `menu_style_choices` – per-user per-dish context cache (style, locale, last_used_at).
   - `menu_packaging_profiles` + `menu_packaging_units` – locale/store pack-size mappings.
   - `menu_user_preferences` – locale, dietary/allergen tags, default people count, scaling flags.
   - `menu_feature_vectors` – owner-scoped embeddings/metadata for ML routing.
   - `menu_recipes` dietary/allergen fields (migration `0020_menu_recipe_dietary.sql`).
   - RLS policies & indexes for each table (migrations `0012_menu_core.sql`, `0019_menu_intel_foundation.sql`, `0020_menu_recipe_dietary.sql`).
2. **Supabase functions/contracts**
   - `/menu-sessions` POST/GET/PATCH (creates session, polls OCR/ML status, updates cards) with premium enforcement.
   - `/menu-recipes` CRUD endpoints for persisted cards + smart edits.
   - `/menus-titles` GET/POST – title-only library sync + daily cap enforcement (idempotent).
   - `/menus/lists` POST – consolidation service returning normalized list lines + writes to `lists/list_items` when requested (idempotent).
   - `/menus/pairings` GET/POST/DELETE – curated combos + user-saved combos.
   - `/menu-session-items` POST/GET/PATCH – OCR detections (text, bounding boxes, classifier tags).
   - `/menus-policy` GET/PATCH – returns and updates entitlement/limit metadata + dietary/allergen preferences.
   - `/menus-packaging` POST – ML/stubbed packaging normalizer that updates `menu_packaging_units`.
3. **Observability scaffolding**
   - Structured logging (session_id, request_id, user_id).
   - Metrics for ingestion latency, recipe-generation success, preference enforcement, policy lookups, list conversion success.
4. **Docs** – ERD, API contracts, failure modes (timeouts, LLM fallback, packaging lookup miss). Keep docs current to avoid duplicating work.

## Stage 2 – AI Pipeline

1. Wire `menuPrompt` into LLM service with clarifying question support and multi-dish output (`cards`, `consolidated_list`, `menus`).
2. Packaging post-processor that maps ingredients to local pack sizes (uses `menu_packaging_profiles`).
3. Hallucination guards: schema validation, min confidence, fallback template, `clarification_needed` responses.
4. Observability: log prompt metadata, clarification selections, packaging adjustments, fallback usage; enforce timeouts (e.g. `MENU_LLM_TIMEOUT_MS`) and propagate `x-correlation-id` to downstream LLM calls.

## Stage 3 – Frontend Integration

1. Replace placeholder toasts with hooks that call new APIs (React Query/SWR). **Done** via `useMenuSession`, `useMenuRecipes`, `useMenuListConversion`, `useMenuPairings`, `useMenuPolicy`.
2. Persist card scaling (people counts) via API; add lock toggle & rotation/swipe UX.
3. Editing UI for ingredients/method/tips + packaging guidance (“Buy 2 × 400 g cans”).
4. Integrate dietary/allergen preference editor in UI; blur/show warnings when items conflict (backend enforcement live).
5. Server-driven sorting & pairing suggestions; ability to save combos (UI partially wired; needs ML feed + offline cache).
6. Confirmation sheet after Add to List/Create List summarizing merged items + servings (conversion summary present; finalize success states + navigation).
7. Upgrade gating wired to real upgrade path + offline-aware blur cards (policy endpoint ready; UI gating next).

## Stage 4 – Testing, Analytics, Ops

1. Tests: unit (merging, packaging, style cache), integration (ingestion → recipe → list), UI/e2e (selection, scaling, add-all), load/chaos (ingestion + list conversion).
2. Analytics: track upload success/fail, clarifications, add-to-list/create-list, upgrade taps, AI fallbacks.
3. Ops: runbooks for ingestion failure, list conversion failure; feature-flag rollout with canary metrics.
4. Offline support: cache menu cards/combos/policy data via Watermelon DB, queue add-to-list for offline use.

> **Current focus:** Close remaining Stage 1 ingestion wiring + begin Stage 2 prompt contract while frontend wires policy-driven gating and offline caches.
