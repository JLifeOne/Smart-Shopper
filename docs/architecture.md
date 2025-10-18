# Smart Shopper Architecture Overview

## Vision
Deliver a cross-platform mobile experience that helps shoppers capture lists, ingest receipts, normalize unit prices, and surface insights like cheapest store comparisons and spending heatmaps. The system must be reliable, secure, and support incremental expansion toward crowdsourced data and alerts.

## High-Level Architecture
- **Mobile App (React Native + Expo, TypeScript)**  
  - Offline-first data layer using SQLite via WatermelonDB.  
  - Feature modules: List Capture, Receipt Scan, Catalog/Price Compare, Calendar Insights, Account & Sharing.  
  - Background sync service for receipts, price updates, and shared list changes.  
  - Push notifications (Expo Notifications) for future price alerts.
- **Backend (Supabase/Postgres + Edge Functions)**  
  - Auth via Supabase Auth with social providers, magic links, and MFA option.  
  - Firehose ingestion endpoints for OCR output, receipt parsing results, and crowdsourced price submissions.  
  - Row Level Security (RLS) enforcing per-user and shared-list access.  
  - CRON/Edge functions for scheduled tasks (trend calculations, stale price pruning, alert dispatch).
- **Machine Learning Services**  
  - OCR: On-device Google ML Kit; fallback to hosted model served via Cloud Run (gated API key).  
  - NLP Categorization & Alias Resolution: Managed as server-side functions with retrain jobs triggered via Supabase storage events.

## Mobile App Modules
1. **Authentication & Profile**  
   - Supabase Auth SDK with session persistence and biometric unlock.  
   - Profile settings for locale, currency, tax preferences.
2. **List Capture**  
   - Text input, voice dictation (Expo Speech), photo capture pipeline.  
   - OCR handling: extract text, pipeline into tokenization module, map to catalog.  
   - Correction UI with swipe gestures and quick re-tagging.
3. **Receipt Ingestion**  
   - Multi-image capture with perspective correction.  
   - Upload queue stored locally; retries with exponential backoff.  
   - Validation sheet summarizing parsed line items for quick edits.
4. **Pricing & Comparison**  
   - Catalog store per store/location; computed unit price normalization functions.  
   - Store comparison view with color-coded chips and trend indicators.  
   - Price history sparkline using Victory Native charts.
5. **Calendar Insights**  
   - Heatmap component with lazy loading by month.  
   - Detail view aggregates store visits, savings, volatility scores.
6. **Sharing & Collaboration**  
   - Real-time sync via Supabase Realtime channels.  
   - Role-based permissions: owner, editor, viewer.  
   - Presence indicators and conflict resolution rules.

## Backend Components
- **Database Schema (Postgres)** embracing the PRD data model with RLS policies.
- **Edge Functions**  
  - `processReceipt`: accepts OCR payload, matches products, writes `PricePoint` entries.  
  - `updateTrends`: nightly job recalculating moving averages and volatility metrics.  
  - `listSharing`: manages invitations, tokens, and permissions.  
- **Storage Buckets** for images (receipts, shelf photos) with signed URLs and lifecycle policies.
- **Analytics Pipeline**  
  - Supabase Logs -> BigQuery export for BI dashboards.  
  - Derived metrics stored in materialized views for fast mobile queries.

## Security & Compliance
- Enforce Supabase RLS for every table; use postgres functions to gate writes.  
- Encrypt sensitive data at rest (Supabase default) and in transit (TLS).  
- Signed URLs with short TTL for image access; revoke on share removal.  
- Store minimal PII; allow user-triggered data export/delete flows (GDPR readiness).  
- Implement client-side secure storage for tokens (Expo SecureStore).  
- Threat modeling focus: forged price submissions, replay attacks on receipt upload, and abuse of sharing features.

## DevOps & Tooling
- Monorepo managed with PNPM workspaces (app + backend + shared lib).  
- Static analysis: ESLint, TypeScript strict mode, Prettier, Zod runtime validation.  
- Mobile CI/CD: Expo EAS (build & submit).  
- Backend CI: GitHub Actions for DB migrations (Sqitch/Prisma) + unit tests.  
- Release strategy: feature flags toggled via Supabase config tables.

## Observability
- Mobile analytics via Expo Application Services + Segment bridge.  
- Error reporting: Sentry for both mobile and edge functions.  
- Performance tracing: React Native Performance for client, OpenTelemetry for backend.

## Future Extensions
- Price alerts via scheduled functions and push/email connectors.  
- Crowdsourced moderation queue with trust scoring service.  
- Pantry inventory predictions using ML model hosted in Vertex AI or AWS SageMaker.

---
This architecture anchors the MVP roadmap while leaving room for growth-phase features such as contributions, alerts, and geofencing.
