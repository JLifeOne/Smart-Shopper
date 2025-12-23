# Runbook — Expo/Metro on Windows (PNPM)

This runbook covers common Windows issues starting the Expo dev server in a pnpm monorepo.

## Symptoms
- `Error: Cannot find module 'metro-runtime/package.json'` when running `pnpm --filter @smart-shopper/mobile start ...`.
- `EPERM: operation not permitted, unlink ...` during `pnpm add` / `pnpm install`.
- Port conflicts on 8081 (Metro’s default) causing startup failure or hanging.
- Android dev client shows a red screen with `java.net.SocketTimeoutException: Failed to connect to /192.168.x.x` (Metro bundle URL unreachable).

## Root Causes
1. `metro-runtime` missing from the mobile package due to pnpm hoisting/isolation.
2. Files locked by Node/VS Code/antivirus preventing pnpm from unlinking `.pnpm` store entries.
3. A stray Metro/React Native process still holding port `8081`.
4. Metro is advertising an IP/host the Android emulator cannot reach (firewall, wrong host mode, or mixed WSL/Windows installs).

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

## Guardrails (Prevent Recurrence)
- Always run `pnpm install` from Windows PowerShell for Windows development; avoid mixing WSL/Windows installs for the same workspace.
- Before `start`, run `pnpm verify` to catch type errors that can break Metro.
- Add a prestart check locally:
  - Run: `pnpm -w verify` and `pnpm approve-builds` (for `esbuild`) after fresh installs.
- Use the included `scripts/kill-port.ps1 -Port 8081` to free the Metro port quickly.

## Notes
- Antivirus or file indexers can lock pnpm’s store. Running PowerShell as Administrator and closing editors usually resolves EPERM.
- If the error persists, try `pnpm store prune` and then `pnpm install`.
