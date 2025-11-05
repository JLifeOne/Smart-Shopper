# Immediate Next Steps

1. **Confirm Tech Stack Choices**
   - Finalize decision between Supabase vs Firebase for backend hosting.  
   - Decide on Expo EAS subscription tier and distribution strategy.
2. **Bootstrap Repository**
   - Initialize PNPM workspace with packages:
     - `apps/mobile` (Expo React Native, TypeScript, WatermelonDB).  
     - `packages/ui` (shared components, theming, Storybook).  
     - `packages/core` (domain models, Zod validators, API client).  
     - `supabase` (database schema, migrations using Prisma or Sqitch).
   - Configure linting, formatting, Git hooks (Husky + lint-staged).
3. **Set Up Supabase Project**
   - Create tables per PRD data model with row level security policies.  
   - Define SQL functions for unit price normalization, cheapest store lookup, trend updates.  
   - Provision storage buckets and policies for receipts/photos.
4. **Implement Auth Skeleton**
   - Add Supabase client, session context provider, login/signup screens.  
   - Secure token storage (Expo SecureStore) and biometric gate option.
5. **Offline Data Layer**
   - Configure WatermelonDB schema for lists, list items, product references, pending uploads.  
   - Create sync adapters to reconcile with Supabase (pull + push).
6. **Proof of Concept Flows**
   - Text-based list creation with optimistic sync and category assignment.  
   - Stub receipt upload (fake parser) to verify pipeline end-to-end.  
   - Basic store comparison view using mocked data.
7. **Security & Observability Foundations**
   - Integrate Sentry and Segment in app; set environment gating.  
   - Add ESLint security plugin and dependency audit workflow in CI.

Once these scaffolding tasks are complete, proceed with Phase A feature implementation following the roadmap.
