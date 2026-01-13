# Issue Log (Append-Only)

## How to add entries
- Append new entries at the bottom; do not edit or reorder past entries.
- Use timestamp format `YYYY-MM-DD HH:MM TZ` (24-hour).
- Include: Summary, Impact, Root Cause, Fix, Validation, Prevention.

## Entries

### 2026-01-09 16:34 UTC — Metro bundler stack overflow (Expo Router)
Summary: Metro bundling failed with `Maximum call stack size exceeded` and the import stack showed `index.js → expo-router/entry → ./index`.
Impact: Dev client could not load the bundle; local Android runs blocked.
Root Cause: A custom `resolveRequest` override in `apps/mobile/metro.config.cjs` invoked `MetroResolver.resolve`, which re-invoked `resolveRequest`, creating infinite recursion. There were no `.ts` extension imports requiring the fallback.
Fix: Remove the `resolveRequest` override entirely; keep the Metro config that limits watch folders and blocklists workspace `node_modules`. Keep the JS shim so Metro loads config reliably.
Validation: Run `pnpm start:clear -- --host lan --port 8081`, then `pnpm android` and confirm bundling completes.
Prevention: Require repo-wide search and evidence before adding overrides; document expected failure modes and validate end-to-end.

### 2026-01-09 16:49 UTC — Metro unable to resolve `expo-router/entry`
Summary: Metro bundling failed with `Unable to resolve "expo-router/entry" from "apps\\mobile\\index.js"`.
Impact: Dev client could not load the bundle; local Android runs blocked.
Root Cause: The Metro config removed the workspace root from `watchFolders` to avoid Windows `EACCES`, but did not add the pnpm virtual store (`.pnpm`) to `watchFolders`. Since pnpm packages are symlinked to `.pnpm` outside the app root, Metro could not follow the symlinks and resolve `expo-router/entry`.
Fix: Add `virtualStoreDir` (`.pnpm`) to `config.watchFolders` while continuing to blocklist `packages/*/node_modules`.
Validation: Run `pnpm start:clear -- --host lan --port 8081`, then `pnpm android` and confirm `expo-router/entry` resolves.
Prevention: When changing Metro `watchFolders`, explicitly account for pnpm virtual store resolution and verify a core dependency resolves in Metro.

### 2026-01-09 16:55 UTC — Partial Metro fix without end-to-end validation
Summary: A Metro fix was applied without full end-to-end validation, allowing a follow-on resolution error to slip through.
Impact: Additional debugging time and disrupted development flow.
Root Cause: The change addressed one failure mode but did not validate the full run path (bundle + dev client) and did not verify pnpm virtual store resolution.
Fix: Require end-to-end validation for debugging and fixes, including Metro bundle success and dev client load.
Validation: Added guardrails in `AGENTS.md`; confirm full `pnpm start:clear` + `pnpm android` cycle passes.
Prevention: Enforce mandatory end-to-end validation for every debugging/fix pass and record outcomes in this log.

### 2026-01-09 17:41 UTC — Metro cannot resolve Supabase shared classifier
Summary: Metro bundling failed with `Unable to resolve "../../../../supabase/functions/_shared/hybrid-classifier"`.
Impact: Mobile dev client bundling blocked; Android run could not load.
Root Cause: Workspace root was removed from Metro `watchFolders` to avoid Windows `EACCES`, but the Supabase shared folder was not explicitly added. Metro does not resolve files outside the project root unless they are in `watchFolders`.
Fix: Add `supabase/functions/_shared` as an explicit Metro watch folder in `apps/mobile/metro.config.cjs`, without re-adding the full workspace root.
Validation: Run `pnpm start:clear -- --host lan --port 8081` and confirm the bundle resolves `hybrid-classifier`, then `pnpm android` to load the dev client.
Prevention: When mobile imports code outside `apps/mobile`, add the exact external path to Metro `watchFolders` and validate a full dev-client load.

### 2026-01-10 16:04 UTC — Saved dishes not visible after menu save
Summary: Saved dishes could disappear after saving from the Menus screen.
Impact: Users saw no saved dishes after saving, blocking menu review and list creation flows.
Root Cause: `handleSaveDish` in `apps/mobile/app/(app)/menus/index.tsx` only fell back to title-only on transient errors. Non-transient `menu-recipes` failures (ex: RLS gating from `0030_menu_entitlements_hardening.sql`, or `recipe_create_failed`) threw and cleared optimistic entries without creating a title-only record. Adjacent dependencies: `supabase/functions/menu-recipes/index.ts`, `supabase/functions/menus-titles/index.ts`, and RLS policies in `0030` and `0036`. Expected failure mode: `menu-recipes` returns 4xx and the saved list stays empty.
Fix: Always attempt title-only fallback when recipe creation fails (except over-limit), logging correlation IDs; keep a local title-only entry if the server fallback fails.
Validation: Pending — run `pnpm start:clear -- --host lan --port 8081`, save dishes as a free and premium user, and confirm saved dishes render. Verify target DB policies match `0036_menu_freemium_limits.sql`.
Prevention: Require policy alignment checks for menu save changes and include the save flow in end-to-end validation.

### 2026-01-11 04:43 UTC — `supabase db push` failed on notifications migration
Summary: Remote `supabase db push` failed on `0035_notifications_promo_alerts.sql` with `function uuid_generate_v4() does not exist`.
Impact: Remote migrations stopped before `0036_menu_freemium_limits.sql`, leaving premium-only RLS on `menu_recipes` and causing saved recipes to disappear for non-premium users.
Root Cause: `0035_notifications_promo_alerts.sql` used `uuid_generate_v4()` without guaranteeing `uuid-ossp` availability on the remote target; the remote environment did not expose that function.
Fix: Replace `uuid_generate_v4()` defaults with `gen_random_uuid()` in `0035_notifications_promo_alerts.sql`, aligning with existing pgcrypto usage across migrations.
Validation: Re-run `supabase db push` and confirm `0035` + `0036` apply; then verify free users can list `menu_recipes` and saved dishes render in the Menus screen.
Prevention: Prefer `gen_random_uuid()` in new migrations and verify extension availability before pushing remote schema changes.

### 2026-01-11 17:02 UTC — Freemium limits displayed as daily
Summary: Free-tier menu limits appeared to be daily, and list-create fallback caps showed as 1.
Impact: UI messaging and gating did not match the intended 3 total lifetime menu runs for freemium users.
Root Cause: Cached menu policy payloads without `limits.limitWindow` defaulted to `'day'`, and fallback limits in `menu-storage`/Menus UI did not align with server policy.
Fix: Infer `limitWindow` from `isPremium` when missing, normalize cached limits, and align fallback caps to freemium lifetime 3 / premium daily 10; update tests and docs.
Validation: Run `pnpm verify`, `supabase test db`, and confirm the Menus screen shows lifetime messaging for free users and blocks after 3 total runs.
Prevention: Normalize policy limits on read, keep fallbacks aligned to server policy, and validate UI messaging alongside server enforcement.

### 2026-01-12 00:14 UTC — menus-policy TypeScript limitWindow mismatch
Summary: Edge function typecheck failed because `limits.limitWindow` was inferred as `string` instead of the `"day" | "lifetime"` union.
Impact: CI `deno check` failed for `supabase/functions/menus-policy/index.ts`.
Root Cause: `limitsBase` used an untyped object literal, widening `limitWindow` to `string` when the policy type expects a strict union.
Fix: Introduce a typed `limitWindow` variable and use `satisfies` to enforce the limits shape without widening.
Validation: Run `deno check --config supabase/functions/deno.json supabase/functions/menus-policy/index.ts`.
Prevention: Keep limits objects typed with `satisfies` (or explicit union annotations) to avoid widening and catch mismatches at compile time.

### 2026-01-13 10:08 UTC — Centralize menu limit defaults in shared helper
Summary: Menu limit defaults were duplicated across edge functions, risking drift and TypeScript mismatches.
Impact: Future changes to freemium/premium limits could desync policy vs enforcement, causing incorrect gating or type failures.
Root Cause: Limits were defined inline in multiple functions instead of a single typed source of truth.
Fix: Add `supabase/functions/_shared/menu-limits.ts` and use it in `menus-policy` and `menus-llm` for consistent limits and limit windows.
Validation: Pending — run `deno check --config supabase/functions/deno.json supabase/functions/menus-policy/index.ts` and `deno check --config supabase/functions/deno.json supabase/functions/menus-llm/index.ts`.
Prevention: Use the shared helper for all menu-limit enforcement/policy updates and avoid inline limit constants.
