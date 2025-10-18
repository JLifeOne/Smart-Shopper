# Smart Shopper Setup Guide

## Prerequisites
- Node.js 18.x (includes npm + corepack)
- PNPM (corepack enable pnpm) or install locally with 
pm install -g pnpm
- Expo CLI (
pm install -g eas-cli optional for builds)
- Supabase CLI (optional for local backend emulation)

## Repository Bootstrapping
`ash
pnpm install                # installs workspace dependencies
pnpm --filter @smart-shopper/mobile dev   # start Expo dev server
`

If pnpm is unavailable, run 
px pnpm install to use the bundled version.

## Mobile App Scripts
- pnpm --filter @smart-shopper/mobile start — start Metro bundler
- pnpm --filter @smart-shopper/mobile android — launch Android build
- pnpm --filter @smart-shopper/mobile ios — launch iOS build
- pnpm --filter @smart-shopper/mobile test — run Jest tests
- pnpm --filter @smart-shopper/mobile lint — run ESLint

## Packages
- packages/core — domain models, validation, pricing helpers.
- packages/ui — shared UI primitives built with React Native.
- packages/theme — design tokens.

Build any package via pnpm --filter <package> build.

## Supabase
1. Install the Supabase CLI (https://supabase.com/docs/guides/cli).
2. From supabase/, run supabase start to boot the local stack.
3. Apply schema: supabase db reset.
4. When ready, create Edge Functions via supabase functions new <name>.

## Environment Variables
Create pps/mobile/.env with the following placeholders:
`
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
`

Use expo-env-info or the Expo config to ensure secrets are loaded via pp.config.ts once implemented.

## Next Engineering Tasks
1. Install dependencies (pnpm).
2. Hook Supabase client into the Expo app (authentication context).
3. Flesh out list capture screens + offline storage (WatermelonDB integration).
4. Implement receipt ingestion edge function skeletons.

Track progress against docs/roadmap.md and docs/next-steps.md.
