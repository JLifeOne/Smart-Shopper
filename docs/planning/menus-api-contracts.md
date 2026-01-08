# Menus API Contracts (Stage 1)

This document formalizes the Supabase edge-function contracts needed to move Menus from a UI demo to production. All endpoints require a valid Supabase JWT and respect RLS policies introduced in `0012_menu_core.sql` and `0019_menu_intel_foundation.sql`.

---

## 1. Menu Sessions (`/menu-sessions`)

### Create session – `POST /menu-sessions`
Creates a draft ingestion session before OCR/LLM processing.

Headers
- `Idempotency-Key` (required): ensures session creation and daily usage accounting are replay-safe under retries/double-taps.
- `x-correlation-id` (optional): propagated through function logs for tracing.

```json
Request body
{
  "source": {
    "type": "camera" | "gallery",
    "uri": "file://..."
  },
  "title_hint": "Birthday brunch",
  "isPremium": true
}
```

Response `201`
```json
{
  "id": "uuid",
  "status": "pending",
  "isPremium": true,
  "createdAt": "2025-03-14T00:02:33Z"
}
```

### Poll session – `GET /menu-sessions/:id`
Returns ingestion status, warnings, derived dish titles, and generated card previews. 404 if the session is not owned by the caller. Includes `expiresAt` to help purge drafts.

### Update session – `PATCH /menu-sessions/:id`
Used to acknowledge clarification responses, attach manual edits, or mark deletion.

```json
{
  "status": "needs_clarification",
  "clarification": {
    "dishKey": "curry_chicken",
    "question": "Jamaican, Indian, or Thai?",
    "answer": "Jamaican"
  },
  "cardIds": ["uuid", "..."]
}
```

Limits: sessions are allowed for all users, but the server enforces daily caps (freemium 3/day, premium 10/day).

---

## 2. Session items (`/menu-session-items`)

Endpoint used by OCR/intent services to persist the raw detections for a session.

### Create items – `POST /menu-session-items`
```json
{
  "sessionId": "uuid",
  "items": [
    {
      "id": "optional uuid",
      "rawText": "Ackee and saltfish",
      "normalizedText": "ackee and saltfish",
      "confidence": 0.94,
      "boundingBox": { "x": 12, "y": 33, "w": 180, "h": 40 },
      "localeHint": "en_JM",
      "classifierTags": ["main", "jamaican"],
      "status": "pending"
    }
  ]
}
```
Response `201`
```json
{ "items": [ { "id": "uuid", "session_id": "...", "raw_text": "...", ... } ] }
```

### List items – `GET /menu-session-items/:sessionId`
Returns ordered list of detections for a session.

### Update item – `PATCH /menu-session-items/:sessionId`
Payload:
```json
{
  "itemId": "uuid",
  "updates": {
    "normalizedText": "jamaican curry chicken",
    "classifierTags": ["main","jamaican","needs_style_choice"],
    "status": "classified"
  }
}
```

---

## 3. Menu Recipes (`/menu-recipes`)

### List – `GET /menu-recipes?cursor=`
Returns paginated recipes owned by the caller with filters (`course`, `cuisineStyle`, `search`). Default sort: `updated_at desc`.

Access: `menu-recipes` is owner-only (server-enforced via RLS + edge function checks). Daily caps are enforced on session/list usage, not recipe reads.

### Create – `POST /menu-recipes`
Payload mirrors `menu_recipes` columns. Validates JSON schema for ingredients/method entries.

```json
{
  "title": "Jamaican curry chicken",
  "course": "main",
  "cuisineStyle": "Jamaican",
  "servings": { "people_count": 4, "portion_size_per_person": "350g" },
  "scaleFactor": 2,
  "ingredients": [{ "name": "Chicken thighs", "quantity": 1, "unit": "kg" }],
  "method": [{ "step": 1, "text": "Brown chicken" }],
  "packagingNotes": "Buy two 500g trays",
  "dietaryTags": ["gluten_free", "dairy_free"],
  "allergenTags": ["allium"]
}
```

### Update – `PUT /menu-recipes/:id`
Allows full overwrite with optimistic locking via `updated_at` or explicit `version` field.

### Delete – `DELETE /menu-recipes/:id`
Soft-delete optional by setting `deleted_at`; default is hard delete for owner.

---

## 4. Title-only dishes (`/menus-titles`)

Title-only saves are an optional storage path: they persist dish titles server-side and enforce daily caps without relying on local storage.

### List – `GET /menus-titles?sessionId=`
Returns title-only dishes owned by the caller. Optional `sessionId` filter.

### Create – `POST /menus-titles`
Headers
- `Idempotency-Key` (required): prevents duplicates under retries/double-taps and ensures daily usage is only counted once.
- `x-correlation-id` (optional): traced through edge-function logs.

```json
Request body
{
  "title": "Ackee and saltfish",
  "sessionId": "uuid-or-null"
}
```

Response `200`
```json
{
  "item": {
    "id": "uuid",
    "title": "Ackee and saltfish",
    "session_id": null,
    "created_at": "2025-03-14T00:02:33Z",
    "updated_at": "2025-03-14T00:02:33Z"
  },
  "replay": false,
  "correlationId": "string"
}
```

Back-end responsibilities:
- Persist to `menu_title_dishes` with owner-scoped RLS.
- Increment `menu_usage_counters.uploads` so `menus-policy.limits.remainingUploads` matches the free-tier cap across devices.

Expected errors:
- `limit_exceeded` (429): user exceeded daily uploads/title-only cap (`scope: "uploads"`).
- `title_required` (400): missing/empty title.
- `idempotency_key_required` (400).

---

## 5. Packaging-aware list conversion (`POST /menus/lists`)

Converts selected dishes into consolidated shopping lines and optionally writes to `lists`.

```json
{
  "dishIds": ["uuid1","uuid2"],
  "peopleCountOverride": 6,
  "persistList": true,
  "listName": "Weekend dinner",
  "storeId": "uuid-optional"
}
```

Response `200`
```json
{
  "consolidatedList": [
    { "name": "Chicken thighs", "quantity": 3, "unit": "kg", "packaging": "Buy 3 x 1kg tray" },
    { "name": "Coconut milk", "quantity": 3, "unit": "400ml can" }
  ],
  "listId": "uuid-or-null",
  "servings": 6,
  "notes": ["Scaled Jamaican curry chicken to 6 people"]
}
```

Back-end responsibilities:
- Merge ingredients, normalize units, map to packaging units per locale.
- Require and respect `Idempotency-Key` when `persistList: true` so retries/double-taps cannot create duplicate lists or double-charge daily counters.
- Enforce allergen/dietary preferences recorded in `menu_user_preferences`; if conflicts exist return
```json
{
  "error": "preference_violation",
  "violations": [
    { "recipeId": "uuid", "title": "Boil Dumplings", "type": "allergen", "details": ["gluten"] }
  ]
}
```

Limits: list conversion is allowed for all users but daily list-create caps apply (freemium 3/day, premium 10/day).

---

## 6. Pairing suggestions (`GET /menus/pairings`)

`GET /menus/pairings?locale=jm_JM&limit=5`

Returns curated combos with metadata.

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Yard classic",
      "description": "Comfort trio for Sunday brunch",
      "dishIds": ["uuid1","uuid2","uuid3"]
    }
  ]
}
```

Callers can “save combo” by POSTing to `/menus-pairings` (payload `{ title, dishIds, description?, locale? }`) and delete with `DELETE /menus-pairings/:id`. Server enforces ownership and locale defaults.

---

## 7. Menus policy (`GET /menus-policy`)

Returns entitlement data (freemium vs premium limits) and user preferences that drive limits and dietary defaults.

`GET /menus-policy`

Response `200`
```json
{
  "policy": {
    "isPremium": false,
    "accessLevel": "title_only",
    "blurRecipes": true,
    "limits": {
      "maxUploadsPerDay": 3,
      "concurrentSessions": 1,
      "maxListCreates": 1
    },
    "allowListCreation": false,
    "allowTemplateCards": true
  },
  "preferences": {
    "defaultPeopleCount": 1,
    "autoScale": true,
    "allowCardLock": true,
    "locale": "en_US",
    "dietaryTags": ["pescetarian"],
    "allergenFlags": ["peanut"]
  }
}
```

The frontend should cache this response locally (Watermelon DB) for offline gating and re-check when the session changes. Premium users receive `accessLevel: "full"` and `blurRecipes: false`.

`PATCH /menus-policy`

Payload:
```json
{
  "dietaryTags": ["vegan"],
  "allergenFlags": ["peanut","shellfish"],
  "defaultPeopleCount": 2,
  "autoScale": true,
  "allowCardLock": true,
  "locale": "en_US"
}
```

Response mirrors the GET shape with updated preferences.

---

## 8. Packaging update (`POST /menus-packaging`)

Endpoint invoked by the packaging normalizer service (or stub) to upsert pack sizes per ingredient.

Request `POST /menus-packaging`
```json
{
  "locale": "en_US",
  "storeId": null,
  "updates": [
    { "ingredientKey": "coconut milk", "packSize": 400, "packUnit": "ml", "displayLabel": "400 ml can" },
    { "ingredientKey": "chicken thigh", "packSize": 1, "packUnit": "kg", "displayLabel": "1 kg tray" }
  ]
}
```

Response `200`
```json
{
  "profileId": "uuid",
  "units": [
    { "ingredient_key": "coconut milk", "pack_size": 400, "pack_unit": "ml", "display_label": "400 ml can" }
  ]
}
```

- When `profileId` is omitted, the service creates a new profile for the supplied locale/store.
- Upserts are idempotent on `(profile_id, ingredient_key)`.
- Telemetry should record how many units were updated and whether the request originated from ML vs. fallback.
- **Security:** this endpoint is **internal-only** (not for mobile clients). Require an internal secret header (e.g. `x-internal-key`) and execute writes using the service-role key server-side.

---

## Shared Considerations

- **Auth**: All endpoints require Supabase JWT; RLS enforces owner isolation.
- **Validation**: Use Zod or class-validator inside edge functions; respond with typed errors `{ code, message, context }`.
- **Telemetry**: Emit logs with `request_id`/`x-correlation-id`, `user_id`, `session_id` and metrics for latency/success.
- **Idempotency**: Require `Idempotency-Key` for create/side-effect endpoints (`/menu-sessions` POST, `/menus/lists` POST with `persistList: true`, `/menus-reviews` POST, `/menu-recipes` POST/PUT/DELETE, `/menu-regenerate` POST).
- **Rate limits**: enforce per-user limits on uploads and conversions to prevent abuse.

These contracts align with the schemas defined in `0012_menu_core.sql` and will unblock Stage 2 (AI pipeline) and Stage 3 (frontend wiring).
---

## 8. Menu prompt (`POST /menus-llm`)

Endpoint used to generate recipe cards, consolidated shopping lists, and menu suggestions. Currently backed by a stub generator; later wired to the LLM.

Request `POST /menus-llm`
```json
{
  "sessionId": "uuid-optional",
  "locale": "en_US",
  "peopleCount": 4,
  "dishes": [
    { "title": "Jamaican curry chicken", "cuisineStyle": "Jamaican" },
    { "title": "Steamed rice" }
  ],
  "preferences": {
    "dietaryTags": ["gluten_free"],
    "allergenFlags": ["peanut"]
  },
  "policy": { "isPremium": true, "blurRecipes": false }
}
```

Response `200`
```json
{
  "cards": [
    {
      "id": "jamaican-curry-chicken",
      "title": "Jamaican curry chicken",
      "course": "Main",
      "cuisine_style": "en_US",
      "servings": { "people_count": 4, "portion_size_per_person": "1 plate", "scale_factor": 1 },
      "lock_scope": false,
      "ingredients": [{ "name": "Chicken", "quantity": 4, "unit": "unit" }],
      "method": [{ "step": 1, "text": "Prepare base." }],
      "total_time_minutes": 30,
      "tips": ["Adjust seasoning."],
      "list_lines": [{ "name": "Chicken", "quantity": 4, "unit": "unit" }],
      "packaging_guidance": ["Buy 4 x 1 unit Chicken"],
      "summary_footer": "Serves 4 people; portion ~1 plate per person."
    }
  ],
  "consolidated_list": [{ "name": "Chicken", "quantity": 4, "unit": "unit" }],
  "menus": [{ "id": "menu-auto", "title": "Suggested combo", "dishes": ["Jamaican curry chicken"] }]
}
```

- Request payload is validated with Zod; invalid payloads return `400 { error: 'invalid_payload', details: [...] }`.
- Provider selection is runtime-configured in the edge function:
  - `MENU_LLM_PROVIDER=custom` (default): `MENU_LLM_URL` must accept `MenuPromptInput` JSON and return `MenuPromptResponse` JSON.
  - `MENU_LLM_PROVIDER=openai`: calls OpenAI-compatible `chat/completions` with `MENU_LLM_API_KEY`, `MENU_LLM_MODEL`, and optional `MENU_LLM_BASE_URL`.
- If the configured provider fails schema validation or times out, the function falls back to a deterministic stub while preserving typed errors and correlation IDs.
