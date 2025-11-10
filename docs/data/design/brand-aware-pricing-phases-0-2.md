# Brand-Aware Pricing Intelligence — Phases 0–2

**Status**: Draft v0.1  
**Authors**: Codex (Mobile)  
**Stakeholders**: Product (J. Law), Design (UI Lead), Mobile Engineering Lead, Backend/Data Lead, Analytics Partner, Ops/Release

---

## 1. Overview & Goals

We will extend Smart Shopper’s pricing intelligence to operate at the brand level. The system must:

- Capture brand identity and confidence for every price observation (receipt, manual entry, or import).
- Maintain per-brand aggregates (averages, deltas, freshness) to power store comparisons and insights.
- Preserve offline-first behaviour, predictable sync, and observability guardrails.

This document covers Phases 0–2 (foundations → ingestion/normalisation → aggregation/storage). UI surfacing and downstream APIs (Phase 3+) are out of scope.

## 2. Current State

- **Local data**: `products` table stores a free-form `brand` string; no canonical IDs or confidence tracking.
- **Sync**: WatermelonDB `sync_events` queue does not transmit brand metadata. Supabase functions are stubs.
- **Analytics**: Dashboard queries fetch per-user quick stats and heatmap totals only; brand comparisons are absent.
- **Observability**: No telemetry for brand extraction success or failures.

## 3. Requirements

### Functional
- Canonical `brands` dimension with aliases and metadata.
- Receipt ingestion returns `(product_id, brand_id, confidence, source)` alongside line-item pricing.
- Aggregated `brand_price_insights` view with per-store/unit normalised averages, deltas, freshness, and sample counts.
- RPC/Edge functions (Phase 2) exposing insights with paging and filters.

### Non-Functional
- **Performance**: Insight RPC p95 latency < 250 ms; nightly jobs finish < 5 min.
- **Reliability**: p95 error rate < 2% for ingestion + aggregation pipelines.
- **Offline**: Mobile app continues to operate offline; brand metadata sync uses idempotent queues.
- **Security/Privacy**: Supabase RLS enforced; no sensitive PII added; audit logs for brand overrides.

## 4. Scope

**In scope** (Phases 0–2):
- Supabase schema/migrations.
- WatermelonDB schema & sync updates.
- Edge functions for receipt brand extraction.
- Scheduled aggregation job & insight storage.
- Telemetry, metrics, dashboards.

**Out of scope**:
- Mobile UI surfaces.
- Feature flag rollout beyond internal beta.
- External brand partnerships or manual override tooling (to be addressed in Phase 3+).

## 5. Phase 0 — Foundations

### 5.1 Supabase Schema Changes
- `brands` table: `id`, `name`, `normalized_name`, `manufacturer`, `owner`, `created_at`, `updated_at`.
- `brand_aliases`: `id`, `brand_id`, `alias`, `store_id?`, `confidence`, `source`, `updated_at`.
- Modify `products`, `product_aliases`, `price_points` to include `brand_id` (nullable) and maintain referential integrity.
- Materialized view placeholder `brand_rollups_mv` (empty until Phase 2 job writes into it).
- Migrations with reversible scripts and RLS updates (owner scoped; ensure `brand` data is read-only for clients).

### 5.2 WatermelonDB Updates
- Schema v6: add `brand_remote_id`, `brand_confidence`, `brand_source` columns to `products`, `list_items`, `price_snapshots`.
- Migration strategy: backfill new columns with defaults (null/0).
- Update models and repository code with typed accessors.

### 5.3 Runtime Configuration & Kill Switch
- Ship brand telemetry and data flows enabled by default once schemas are in place.
- Add a remote-config toggle backed by Supabase `app_runtime_config` table + `get_runtime_config()` helper; mobile pulls the value on session start.
- If disabled, app suppresses brand fetches/telemetry and surfaces generic pricing copy.
- Document operational runbook for enabling the kill switch, including expected app UX when disabled.

### 5.4 Testing & Tooling
- Unit tests for migrations (Supabase migration harness + Watermelon migration tests).
- Add lint rule placeholders for brand telemetry keys.

## 6. Phase 1 — Ingestion & Normalization

### 6.1 Receipt Brand Resolution Flow
1. Mobile uploads receipt image to Supabase Edge function `process-receipt`.
2. Function parses line items (existing OCR pipeline) and invokes brand resolver:
   - Normalise raw name (tokenise, case-fold, accent-strip).
   - Match against `brand_aliases` for same store; fallback to global alias.
   - If still unknown, create provisional alias (`brand_id = null`, `confidence = 0.1`) for manual review.
3. Return enriched payload: `brand_id`, `brand_name`, `confidence`, `evidence` (alias ID or heuristic), plus `product_id`, `unit_price`.
4. Persist price point with `brand_id` and `brand_confidence` in Supabase.

### 6.2 Sync Queue Enhancements
- Watermelon `sync_events` emits brand metadata in mutations (create/update list item, ingest receipt, manual price edit).
- `SyncService.flushPending` posts to new Supabase RPC `sync_mutation_batch` with idempotency key per event.
- Retry policy: exponential backoff (200 ms → 3 s cap), max 4 attempts; classify errors (`BRAND_MATCH_CONFLICT`, `BRAND_ALIAS_MISSING`, `RETRYABLE_NETWORK`).

### 6.3 Error Taxonomy
- `BRAND_MATCH_CONFLICT`: alias maps to multiple brands above threshold → log, surface to review queue.
- `BRAND_UNCERTAIN`: confidence below `0.4` → fallback to manual confirmation.
- `BRAND_ALIAS_EXPIRED`: alias flagged inactive (owner rebrand) → request refresh.
- `INGESTION_TIMEOUT`, `EDGE_TIMEOUT`, `RATE_LIMITED`.

### 6.4 Metrics
- `brand_match_rate` (matched items / total line items).
- `brand_confidence_avg`.
- `brand_fallback_count` (manual review queue size).
- `alias_lookup_latency_ms`.
- All metrics exported via Supabase Logs → dashboards (Phase 2 logging stack).

## 7. Phase 2 — Aggregation & Storage

### 7.1 Nightly Aggregation Job (`compute_brand_insights`)
- Schedule via Supabase Edge Functions CRON (UTC nightly).
- Steps:
  1. Pull latest `price_points` in lookback window (default 90 days) grouped by `brand_id`, `store_id`, `category`.
  2. Discard outliers using MAD or configurable percentile trim.
  3. Compute metrics: `avg_unit_price`, `min_unit_price`, `max_unit_price`, `delta_vs_category_brand`, `sample_count`, `last_seen_at`, `trend_30d`.
  4. Write results into `brand_price_insights` table (append-only), then refresh materialized view for fast reads.
  5. Emit structured logs with execution time, summarised metrics, and errors.

### 7.2 Insight Storage Model
- `brand_price_insights`: columns:
  - `brand_id`, `store_id`, `category`, `avg_unit_price`, `delta_percent`, `sample_count`, `last_sample_at`, `trend_percent_30d`, `currency`, `confidence`, `created_at`.
- Index on `(brand_id, store_id, category)` and `created_at`.
- TTL policy: preserve 180 days history; purge older rows via scheduled `delete` job.

### 7.3 API Surface
- RPC `brand_insights_for_user(user_id uuid, region text, limit int, offset int, min_confidence float)` returning current MV rows filtered by user’s accessible stores.
- Ensure RLS uses store membership/list sharing context.
- Response envelope includes `aggregation_window`, `last_run_at`, `latency_ms`.

### 7.4 Observability
- Structured logs (JSON) at each pipeline stage.
- Metrics: job duration, records processed, failure count, stale insight count.
- Alerts:
  - Job failure or duration > 10 min (critical).
  - Match rate < 80% (warning).
  - Delta anomalies > configured bounds (info for review).

## 8. Data Flows

### 8.1 Receipt Ingestion Sequence
1. Mobile captures receipt → upload to `storage.receipts`.
2. Edge function `process-receipt` parses lines, resolves brand/product.
3. Supabase writes `price_points` with `brand_id`, returns results to mobile.
4. Mobile updates local DB, enqueues sync event (for offline commit confirmation).

### 8.2 Aggregation Job Flow
1. CRON triggers `compute_brand_insights`.
2. Job queries `price_points` window → aggregates → writes `brand_price_insights`.
3. Materialized view refresh.
4. Metrics/logs emitted; alerts if thresholds crossed.

### 8.3 Sync Consumption Flow
1. On login or periodic refresh, mobile calls `brand_insights_for_user`.
2. Response stored in Watermelon `brand_insights` table (to be added in Phase 3).
3. Feature flag controls whether UI consumes data.

## 9. Security & Compliance
- RLS ensures users only access data belonging to their lists/shared stores.
- Audit logs for manual brand overrides (future expansion).
- No additional PII stored; brands are public catalog metadata.
- Storage buckets maintain existing retention policies; no brand-specific assets stored.

## 10. Testing Strategy

| Layer | Tests |
| --- | --- |
| Schema | Migration up/down tests; RLS access tests for brand tables. |
| Edge Functions | Unit tests for alias matching, heuristics, error taxonomy; integration tests with Supabase test db. |
| Sync Service | Vitest coverage for new queued payloads, retry handling, error classification. |
| Aggregation Job | Deterministic fixtures verifying delta calculations, outlier pruning, incremental runs. |
| Load/Perf | Soak test `brand_insights_for_user` RPC at target concurrency (≥100 RPS) and job runtime under 5 min with 1M price points. |

CI additions: new `pnpm` script to run Supabase test harness + Vitest brand suite; gating via GitHub Actions.

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Sparse brand data (low samples) | Poor insight accuracy | Minimum sample threshold, surface “insufficient data” state, fallback to category avg. |
| Conflicting aliases | Incorrect brand mapping | Confidence thresholds, manual review queue, logging for conflicts. |
| Long-running aggregation job | Cron overlap, stale insights | Idempotent checkpoints, runtime alerts, job cancellation guard. |
| Migration failure in production | Downtime | Blue/green deploy: run migrations during maintenance, backup + rollback script. |
| Edge function throttling | Receipt ingestion failures | Rate limiting with exponential backoff and circuit breaker, queue retries client-side. |

## 12. Rollout Plan

1. **Phase 0 ship** with flag disabled; run migrations in staging, backfill sample data, execute regression tests.
2. **Phase 1** enable ingestion in staging → internal dogfood accounts; monitor `brand_match_rate`.
3. **Phase 2** deploy nightly job + RPC; watch dashboards for 48 h.
4. Document rollback steps: activate remote kill switch, revert migration (if required), pause CRON job, clear failed events queue.

## 13. Open Questions

1. Who owns long-term brand taxonomy curation (product vs data team)?
2. Do we expose manual override tooling in admin console (Phase 3)? Timeline?
3. Should trend comparisons default to brand vs category or vs user’s baseline store?
4. Required retention period for historical brand insights (180 vs 365 days)?
5. Strategy for multi-region brand names (e.g., Grace vs local co-brands); do we store region-specific overrides?

---

## 14. Appendix

### 14.1 Glossary
- **Brand Alias**: A raw string observed in receipts mapping to a canonical brand.
- **Confidence**: Probability (0–1) assigned to the brand resolution.
- **Delta**: Percentage difference between current average and category baseline or competitor brand.
- **Lookback Window**: Sliding time span (default 90 days) for aggregating price points.

### 14.2 Metrics Inventory
- `brand_match_rate` (Gauge)
- `brand_confidence_avg` (Gauge)
- `brand_fallback_count` (Count)
- `alias_lookup_latency_ms` (Timer)
- `brand_aggregation_duration_ms` (Timer)
- `brand_insight_records` (Gauge)
