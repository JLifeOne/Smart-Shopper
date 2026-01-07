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

> Notes on package managers:
> - This repo is a `pnpm` workspace. Use `pnpm --filter <pkg> <script>` for workspace commands.
> - `npm --filter ...` is **not** supported (that flag is pnpm-only) and will warn/error.
> - If you must use `npm`, use workspaces instead: `npm -w @smart-shopper/mobile test`.
> - `.npmrc` contains pnpm-specific settings (`virtual-store-dir`, etc.) for Windows/Metro; `npm` may warn about these. Prefer `pnpm`.

## Windows Path Gotchas

Native Android builds fail if the project lives deep in your home directory (long path issue).

1. Clone or move the repo to a short path such as `C:\ss`.
2. Keep `.npmrc` at the repo root with `virtual-store-dir=C:/p`. Metro resolves modules from this path.
3. From that directory, use:
   - `pnpm --filter @smart-shopper/mobile start -- --dev-client --port 8081`
   - `pnpm --filter @smart-shopper/mobile android`

The dev client will connect to `http://10.0.2.2:<port>` inside the Android emulator.

## Account Settings (Profile)
In the app, open the Command center (⋯) → **Account** to update:
- Display name + region/locale
- Currency + tax preference
- Location + demographics (date of birth, optional gender)
- Optional: link an email + password to your phone account (useful for dev scripts). Supabase will email a confirmation when you change the email.

## Profile Setup (Sign-up Only)
After you verify your phone number during **sign up**, the app will route you to a one-time Profile Setup screen to capture:
- Full name
- Date of birth (age is derived)
- Optional email address (triggers Supabase email verification)
- Location: City/Town, County/Parish, optional Province/State, optional Postal/ZIP, Country
- Optional gender (male/female/prefer_not_to_say)

This setup screen is **not** shown during sign in. All fields remain editable later via Command center (⋯) → **Account**.

## Mobile App Scripts
- pnpm --filter @smart-shopper/mobile start - start Metro bundler
- pnpm --filter @smart-shopper/mobile start:clear - start Metro bundler with cache cleared
- pnpm --filter @smart-shopper/mobile android - launch Android build (requires dev client)
- pnpm --filter @smart-shopper/mobile ios - launch iOS build (requires dev client)
- pnpm --filter @smart-shopper/mobile test - run vitest suite
- pnpm --filter @smart-shopper/mobile lint - run ESLint

If you are already in `apps/mobile/`, you can run the same scripts without `--filter`, e.g.:
- `pnpm start:clear`

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

If you are connecting to a remote Supabase project, ensure the latest migrations are applied (including `0027_profiles_account_settings.sql` and `0028_profiles_demographics.sql`) via `supabase db push`.

## Environment Variables
Create `apps/mobile/.env` with the following placeholders:
```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_MOCK_AUTH=false
EXPO_PUBLIC_FEATURE_PROMO_NOTIFICATIONS=false
EXPO_PUBLIC_EXPO_PROJECT_ID=
EXPO_PUBLIC_NOTIFICATIONS_PROVIDER=expo
EXPO_PUBLIC_ONESIGNAL_APP_ID=
```

`app.config.ts` reads these values at build time. Never expose the Supabase service role key in the mobile app.
Push alerts require a dev client (Expo Go does not support push notifications). Use `expo run:android` or `expo run:ios` after setting `EXPO_PUBLIC_EXPO_PROJECT_ID`.
If you set `EXPO_PUBLIC_NOTIFICATIONS_PROVIDER=onesignal`, ensure `EXPO_PUBLIC_ONESIGNAL_APP_ID` is set and the OneSignal native config/plugin is enabled before building. `auto` will prefer OneSignal when configured, otherwise fall back to Expo.

## Next Engineering Tasks
1. Install dependencies (pnpm install).
2. Wire Supabase auth flows and shared contexts (in progress).
3. Implement WatermelonDB offline cache and sync queues.
4. Build receipt ingestion Edge Function stubs.

Track progress against docs/roadmap.md and docs/next-steps.md.
