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
