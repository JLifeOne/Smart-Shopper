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
