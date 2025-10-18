# Smart Shopper Setup Guide

## Prerequisites
- Node.js 18.x (includes npm + corepack)
- PNPM (corepack enable pnpm) or install globally with 
pm install -g pnpm
- Expo CLI (
pm install -g eas-cli, optional for builds)
- Supabase CLI (optional for local backend emulation)

## Repository Bootstrapping
`ash
pnpm install                          # install workspace dependencies
pnpm --filter @smart-shopper/mobile start -- --tunnel  # start Expo dev server with a tunnel
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
- packages/core — domain models, validation, pricing helpers
- packages/ui — shared UI primitives built with React Native
- packages/theme — design tokens

Build any package via pnpm --filter <package> build.

## Supabase
1. Install the Supabase CLI (https://supabase.com/docs/guides/cli).
2. From supabase/, run supabase start to boot the local stack.
3. Apply schema: supabase db reset.
4. When ready, create Edge Functions via supabase functions new <name>.

## Environment Variables
Create pps/mobile/.env with the following placeholders:
`ash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_MOCK_AUTH=false   # optional, enables fake auth for UI dev
`

pp.config.ts reads these values at build time. Never expose the Supabase service role key in the mobile app.

## Next Engineering Tasks
1. Install dependencies (pnpm install).
2. Wire Supabase auth flows and shared contexts (in progress).
3. Implement WatermelonDB offline cache and sync queues.
4. Build receipt ingestion Edge Function stubs.

Track progress against docs/roadmap.md and docs/next-steps.md.