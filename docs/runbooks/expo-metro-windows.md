# Runbook — Expo/Metro on Windows (PNPM)

This runbook covers common Windows issues starting the Expo dev server in a pnpm monorepo.

## Symptoms
- `Error: Cannot find module 'metro-runtime/package.json'` when running `pnpm --filter @smart-shopper/mobile start ...`.
- `Error: Cannot find module 'metro-resolver'` when running `expo run:android` or Metro.
- `EPERM: operation not permitted, unlink ...` during `pnpm add` / `pnpm install`.
- Port conflicts on 8081 (Metro’s default) causing startup failure or hanging.
- Android dev client shows a red screen with `java.net.SocketTimeoutException: Failed to connect to /192.168.x.x` (Metro bundle URL unreachable).

## Root Causes
1. `metro-runtime` missing from the mobile package due to pnpm hoisting/isolation.
2. `metro-resolver` missing from the mobile package due to pnpm hoisting/isolation.
3. Files locked by Node/VS Code/antivirus preventing pnpm from unlinking `.pnpm` store entries.
4. A stray Metro/React Native process still holding port `8081`.
5. Metro is advertising an IP/host the Android emulator cannot reach (firewall, wrong host mode, or mixed WSL/Windows installs).
6. Metro is watching workspace package `node_modules`, triggering `EACCES` on pnpm/tsup `.ignored_*` sentinel files (Windows file watcher limitation).
7. Metro config is resolved from the workspace root, and a `metro.config.js` (ESM) is ignored in a `type: module` repo.

## Quick Fix (Most Cases)
Run in an elevated PowerShell at repo root (`C:\ss`):

```powershell
# 1) Free Metro port
./scripts/kill-port.ps1 -Port 8081

# 2) Stop Node/Metro processes and clear caches
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and ($_.Path -like '*expo*' -or $_.Path -like '*metro*') } | Stop-Process -Force
Remove-Item -Recurse -Force apps/mobile/.expo, apps/mobile/.expo-shared, apps/mobile/.cache, apps/mobile/node_modules/.cache/metro -ErrorAction SilentlyContinue

# 3) Reinstall deps cleanly (Admin helps avoid EPERM)
pnpm install

# 4) Ensure metro runtime + resolver are present in the mobile package
pnpm add --filter @smart-shopper/mobile -D metro-runtime metro-resolver

# 5) Start on 8081 with a clean cache
pnpm --filter @smart-shopper/mobile start:clear -- --port 8081
```

If you are already in `apps/mobile/`, run:
```powershell
pnpm start:clear -- --port 8081
```

## Fix: `SocketTimeoutException` to `192.168.x.x` (Emulator cannot reach Metro)

If the dev client is trying to load the bundle from a LAN IP (example: `192.168.0.30`) and times out, use one of these stable options:

1) **Tunnel (most reliable across networks)**
```powershell
pnpm --filter @smart-shopper/mobile start:clear -- --port 8081 --host tunnel
```

2) **Localhost + adb reverse (fastest for Android emulator)**
```powershell
adb reverse tcp:8081 tcp:8081
pnpm --filter @smart-shopper/mobile start:clear -- --port 8081 --host localhost
```

3) **LAN (requires firewall allowance)**
- Ensure Windows Firewall allows inbound connections for Node/Metro on port `8081`, then:
```powershell
pnpm --filter @smart-shopper/mobile start:clear -- --port 8081 --host lan
```

If you are switching between WSL and PowerShell, reinstall dependencies in the same environment you run Metro from to avoid platform-specific optional dependency issues.

If step (3) fails with EPERM unlink errors, close VS Code/Terminals, then:

```powershell
attrib -R -S -H .pnpm -Recurse -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .pnpm, node_modules -ErrorAction SilentlyContinue
pnpm install
```

## Fix: Metro `EACCES` on `.ignored_*` under `packages/*/node_modules`

Symptoms:
- `EACCES: permission denied, lstat 'C:\ss\packages\theme\node_modules\.ignored_tsup'`
- Similar errors for `.ignored_dotenv` or other `.ignored_*` entries.

Root cause:
- Metro is watching workspace package `node_modules`. On Windows, the file watcher fails on pnpm/tsup sentinel files under those folders.

Permanent fix:
- Use `metro.config.cjs` (CJS) so Metro can load config reliably in a `type: module` repo.
- Keep a `apps/mobile/metro.config.js` shim that re-exports `metro.config.cjs`, since Metro searches for `metro.config.js` by default.
- `apps/mobile/metro.config.cjs` sets `EXPO_NO_METRO_WORKSPACE_ROOT=1` to avoid Metro auto-watching workspace `node_modules`.
- Update `apps/mobile/metro.config.cjs` to **watch workspace package roots (`packages/*`) and the pnpm virtual store (`.pnpm`)** while **blocklisting `node_modules` inside each workspace package**.
- This prevents Metro from ever traversing those `node_modules` folders and removes the `EACCES` failure mode.
  - The blocklist must match the `node_modules` directory itself (not just files inside it) so the watcher skips traversal on Windows.

PowerShell verification:
```powershell
cd C:\ss\apps\mobile
pnpm android
```

## Guardrails (Prevent Recurrence)
- Always run `pnpm install` from Windows PowerShell for Windows development; avoid mixing WSL/Windows installs for the same workspace.
- Before `start`, run `pnpm verify` to catch type errors that can break Metro.
- Add a prestart check locally:
  - Run: `pnpm -w verify` and `pnpm approve-builds` (for `esbuild`) after fresh installs.
- Use the included `scripts/kill-port.ps1 -Port 8081` to free the Metro port quickly.

## Notes
- Antivirus or file indexers can lock pnpm’s store. Running PowerShell as Administrator and closing editors usually resolves EPERM.
- If the error persists, try `pnpm store prune` and then `pnpm install`.
