# Runbook — Expo/Metro on Windows (PNPM)

This runbook covers common Windows issues starting the Expo dev server in a pnpm monorepo.

## Symptoms
- `Error: Cannot find module 'metro-runtime/package.json'` when running `pnpm --filter @smart-shopper/mobile start ...`.
- `EPERM: operation not permitted, unlink ...` during `pnpm add` / `pnpm install`.
- Port conflicts on 8081 (Metro’s default) causing startup failure or hanging.

## Root Causes
1. `metro-runtime` missing from the mobile package due to pnpm hoisting/isolation.
2. Files locked by Node/VS Code/antivirus preventing pnpm from unlinking `.pnpm` store entries.
3. A stray Metro/React Native process still holding port `8081`.

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

# 4) Ensure metro-runtime is present in the mobile package
pnpm add --filter @smart-shopper/mobile -D metro-runtime

# 5) Start on 8081 with a clean cache
pnpm --filter @smart-shopper/mobile start -- --dev-client --port 8081 --clear
```

If step (3) fails with EPERM unlink errors, close VS Code/Terminals, then:

```powershell
attrib -R -S -H .pnpm -Recurse -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .pnpm, node_modules -ErrorAction SilentlyContinue
pnpm install
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

