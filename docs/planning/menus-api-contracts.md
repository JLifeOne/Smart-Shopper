# Menus API Contracts (Stage 1)

This document formalizes the Supabase edge-function contracts needed to move Menus from a UI demo to production. All endpoints require a valid Supabase JWT and respect RLS policies introduced in `0011_menu_core.sql` and `0017_menu_intel_foundation.sql`.

---

## 1. Menu Sessions (`/menu-sessions`)

### Create session – `POST /menu-sessions`
Creates a draft ingestion session before OCR/LLM processing.

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

Premium gating: non-premium users can create sessions, but the server must block downstream recipe generation and only surface title-only responses.

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
  "packagingNotes": "Buy two 500g trays"
}
```

### Update – `PUT /menu-recipes/:id`
Allows full overwrite with optimistic locking via `updated_at` or explicit `version` field.

### Delete – `DELETE /menu-recipes/:id`
Soft-delete optional by setting `deleted_at`; default is hard delete for owner.

---

## 4. Packaging-aware list conversion (`POST /menus/lists`)

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
- Respect idempotency key (`menus-list-convert-{dishIds-hash}`) to avoid duplicate lists.
- Return actionable errors (e.g., insufficient data to normalize).

---

## 5. Pairing suggestions (`GET /menus/pairings`)

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

## 6. Menus policy (`GET /menus-policy`)

Returns entitlement data (premium vs. title-only) and user preferences that drive blur states, limits, and dietary defaults.

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

---

## Shared Considerations

- **Auth**: All endpoints require Supabase JWT; RLS enforces owner isolation.
- **Validation**: Use Zod or class-validator inside edge functions; respond with typed errors `{ code, message, context }`.
- **Telemetry**: Emit logs with `request_id`, `user_id`, `session_id` and metrics for latency/success.
- **Idempotency**: For actions that mutate (`/menus/lists`, `/menu-recipes`), require `Idempotency-Key` header.
- **Rate limits**: enforce per-user limits on uploads and conversions to prevent abuse.

These contracts align with the schemas defined in `0011_menu_core.sql` and will unblock Stage 2 (AI pipeline) and Stage 3 (frontend wiring).
