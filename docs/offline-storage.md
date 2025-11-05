# Offline Storage Plan

## Goals
- Provide resilient offline-first UX for list capture, receipt ingestion, and price browsing.
- Minimise merge conflicts when syncing with Supabase while preserving user edits.
- Support queued mutations for scans, manual price edits, and list updates.

## Stack
- `@nozbe/watermelondb` with SQLite adapter (Expo recommended combo).
- Custom bridge for background sync via Expo task manager (future enhancement).
- Shared domain models from `@smart-shopper/core` for type-safe mapping.

## Local Schema
| Collection | Purpose |
|------------|---------|
| `lists` | Local copy of `List` entities with sync metadata. |
| `list_items` | Items tied to lists, includes local-only flag for unsynced entries. |
| `products` | Cached product metadata and aliases used for auto-complete. |
| `price_snapshots` | Recent price points for offline comparisons; trimmed per-store. |
| `receipt_uploads` | Queue of pending receipt images + OCR output awaiting upload. |
| `sync_events` | Change log containing mutation type, payload hash, retry count. |

Each table includes:
- `last_synced_at` timestamp (nullable) to track freshness.
- `dirty` boolean to indicate unsynced mutations.
- `device_id` (from SecureStore) for conflict resolution heuristics.

## Sync Strategy
1. **Bootstrap**: pull user lists + items + recent prices after auth; seed caches.
2. **Mutations**: write to WatermelonDB first; append record to `sync_events`.
3. **Uploader**: background job (app foreground interval + optional task manager) batches events to Supabase Edge Functions.
4. **Conflict Resolution**:
   - Use `updated_at` comparisons; prefer latest timestamp unless user explicitly overrides.
   - For list items, merge quantities if edits happen offline, otherwise mark conflict for UI prompt.
5. **Downloads**: incremental sync using Supabase `updated_at` filters; update WatermelonDB via `database.write`.
6. **Receipts**: store images + extracted text offline; attempt upload when network resumes. After successful parse, replace local items with confirmed price points.

## Implementation Steps
1. Add WatermelonDB dependency, configure native adapter via Expo config plugin.
2. Define database schema mirroring core models (List, ListItem, Product, PricePoint).
3. Create repository layer translating between Watermelon collections and shared domain types.
4. Implement sync service with strategies:
   - `enqueueMutation(type, payload)`
   - `flushMutations()` (called on focus + background timer)
   - `pullDelta({ since })` for incremental downloads.
5. Integrate with auth provider to reset DB on sign-out.
6. Cover core flows with tests:
   - Mutation queue deduplication.
   - Conflict resolution for list item edits.
   - Receipt upload retry with exponential backoff.

## Security Notes
- Encrypt SQLite database using native encryption plugin (work item to evaluate; interim store non-sensitive data only).
- Store auth tokens exclusively in SecureStore (already handled by Supabase storage adapter).
- Use checksum (e.g., SHA-256) for queued receipts to avoid duplicate uploads.

## Next Actions
1. Prototype WatermelonDB schema + adapter wiring.
2. Implement sync queue + background flush for lists/items.
3. Extend to receipts + price caches once Edge Functions are available.
