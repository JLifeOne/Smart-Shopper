# Smart Shopper Setup Guide

## Prerequisites
- Node.js 18.x (includes npm + corepack)
- pnpm (run `corepack enable pnpm` or install globally with `npm install -g pnpm`)
- Expo CLI (`npm install -g eas-cli`, optional for native builds)
- Supabase CLI (optional for local backend emulation)
- Android Studio + emulator (primary test target; launch via AVD Manager)

## Repository Bootstrapping
```bash
pnpm install
pnpm --filter @smart-shopper/mobile start -- --tunnel
```

If pnpm is unavailable, run `npx pnpm install` to use the bundled version.

## Windows Path Gotchas

Native Android builds fail if the project lives deep in your home directory (long path issue).

1. Clone or move the repo to a short path such as `C:\ss`.
2. Keep `.npmrc` at the repo root with `virtual-store-dir=C:/p`. Metro resolves modules from this path.
3. From that directory, use:
   - `pnpm --filter @smart-shopper/mobile start -- --dev-client --port 8081`
   - `pnpm --filter @smart-shopper/mobile android`

The dev client will connect to `http://10.0.2.2:<port>` inside the Android emulator.

## Mobile App Scripts
- pnpm --filter @smart-shopper/mobile start - start Metro bundler
- pnpm --filter @smart-shopper/mobile android - launch Android build (requires dev client)
- pnpm --filter @smart-shopper/mobile ios - launch iOS build (requires dev client)
- pnpm --filter @smart-shopper/mobile test - run vitest suite
- pnpm --filter @smart-shopper/mobile lint - run ESLint

> **Note:** WatermelonDB relies on JSI. Use a custom development client (expo run:android / expo run:ios) rather than Expo Go when testing database features.

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
Create `apps/mobile/.env` with the following placeholders:
```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_MOCK_AUTH=false
```

`app.config.ts` reads these values at build time. Never expose the Supabase service role key in the mobile app.

## Next Engineering Tasks
1. Install dependencies (pnpm install).
2. Wire Supabase auth flows and shared contexts (in progress).
3. Implement WatermelonDB offline cache and sync queues.
4. Build receipt ingestion Edge Function stubs.

Track progress against docs/roadmap.md and docs/next-steps.md.
