# Menus Production Rollout Plan

## Stage 1 – Data & API Foundations (current work)

1. **Schema & migrations**
   - `menu_recipes` – persisted cards (title, course, cuisine_style, servings JSON, ingredients JSONB, method JSONB, tips, packaging_notes, owner_id, premium flag, timestamps).
   - `menu_sessions` – draft uploads with status + progress metadata.
   - `menu_combos` – saved pairings (title, description, dish_ids[], locale, owner_id, timestamps).
   - `menu_style_choices` – per-user per-dish context cache (style, locale, last_used_at).
   - `menu_packaging_profiles` + `menu_packaging_units` – locale/store pack-size mappings.
   - RLS policies & indexes for each table.
2. **Supabase functions/contracts**
   - `/menu-sessions` POST/GET/PATCH (creates session, polls OCR/LLM status, updates cards) with premium enforcement.
   - `/menu-recipes` CRUD endpoints for persisted cards + smart edits.
   - `/menus/lists` POST – consolidation service returning normalized list lines + writes to `lists/list_items` when requested (idempotent).
   - `/menus/pairings` GET – returns combos per locale.
3. **Observability scaffolding**
   - Structured logging (session_id, request_id, user_id).
   - Metrics for ingestion latency, recipe-generation success, list conversion success.
4. **Docs** – ERD, API contracts, failure modes (timeouts, LLM fallback, packaging lookup miss).

## Stage 2 – AI Pipeline

1. Wire `menuPrompt` into LLM service with clarifying question support and multi-dish output (`cards`, `consolidated_list`, `menus`).
2. Packaging post-processor that maps ingredients to local pack sizes (uses `menu_packaging_profiles`).
3. Hallucination guards: schema validation, min confidence, fallback template, `clarification_needed` responses.
4. Observability: log prompt metadata, clarification selections, packaging adjustments, fallback usage.

## Stage 3 – Frontend Integration

1. Replace placeholder toasts with hooks that call new APIs (React Query/SWR):
   - Upload (camera/gallery) → menu session.
   - Save dish / open recipe / add-all / create list / save combo.
2. Persist card scaling (people counts) via API; add lock toggle & rotation/swipe UX.
3. Editing UI for ingredients/method/tips + packaging guidance (“Buy 2 × 400 g cans”).
4. Server-driven sorting & pairing suggestions; ability to save combos.
5. Confirmation sheet after Add to List/Create List summarizing merged items + servings.
6. Upgrade gating wired to real upgrade path.

## Stage 4 – Testing, Analytics, Ops

1. Tests: unit (merging, packaging, style cache), integration (ingestion → recipe → list), UI/e2e (selection, scaling, add-all), load/chaos (ingestion + list conversion).
2. Analytics: track upload success/fail, clarifications, add-to-list/create-list, upgrade taps, AI fallbacks.
3. Ops: runbooks for ingestion failure, list conversion failure; feature-flag rollout with canary metrics.
4. Offline support: cache menu cards/combos, queue add-to-list for offline use.

> **Current focus:** Stage 1 – implement Supabase schema/migrations + document API contracts.

