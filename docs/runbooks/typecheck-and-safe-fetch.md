# Runbook — Typecheck & Safe Fetch Guardrails

## Context
Two issues recently blocked `pnpm verify`:
1. **Missing TypeScript binaries** (`Cannot find module '.../node_modules/typescript/bin/tsc'`). Triggered when dependencies were reinstalled from WSL and the Windows `node_modules` folder vanished.
2. **`AbortSignal` typing mismatch** in `apps/mobile/src/lib/safeFetch.ts`, leading to `TS2769` overload errors in both PowerShell and WSL.

This runbook documents causes, fixes, and preventive guardrails.

## 1. Missing `tsc`
### Cause
- Running `pnpm install` from WSL rewrote `node_modules` using the Linux store path (`/mnt/c/.pnpm-store/v10`).
- The Windows install still pointed at `C:\ss\node_modules`, but the TypeScript package there was removed, so PowerShell could no longer resolve `tsc`.

### Fix
1. From PowerShell, reinstall dependencies to recreate the Windows `node_modules` tree:
   ```powershell
   pnpm install
   ```
2. If pnpm rebuilds the Windows store path, allow it to remove the old modules directory when prompted.
3. Re-run `pnpm verify` to confirm `tsc --noEmit` works for each workspace.

### Guardrails
- Prefer running `pnpm install` from the same OS/session that runs CI (Windows PowerShell). If installing from WSL, immediately run `pnpm install` again in PowerShell to sync.
- Keep `pnpm` store pointing to the same location on both sides (`pnpm install --store-dir /mnt/c/.pnpm-store/v10`).
- Before pushing, always run `pnpm verify` on Windows; CI mirrors that environment.

## 2. `safeFetch` AbortSignal Types
### Cause
- Node 20’s `AbortSignal` type differs from React Native’s `AbortSignal`. Our previous helper asserted the RN signal satisfied `global.AbortSignal`, which TypeScript rejected (`TS2769`).

### Fix
- Replace the RN-specific helper with a thin delegate:
  ```ts
  const fetchFn: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch as any;
  const response = await fetchFn(input, { ...init, signal: controller.signal as any });
  ```
- This preserves runtime behavior and avoids Typescript’s cross-environment type mismatch.

### Guardrails
- Keep the helper minimal—avoid referencing DOM-specific `AbortSignal` types in shared code.
- When updating `safeFetch`, validate in both PowerShell and WSL with `pnpm exec tsc --project apps/mobile/tsconfig.json --pretty false`.

## Verification Checklist
- `pnpm verify` (PowerShell): PASS ✓
- `pnpm exec tsc --project apps/mobile/tsconfig.json --pretty false` (WSL optional)
- `python scripts/jsx_sanity_check.py` (requires Python 3)

## Command Reference
```powershell
# Windows
pnpm install
pnpm verify

# WSL (if needed)
pnpm install --store-dir /mnt/c/.pnpm-store/v10
pnpm exec tsc --project apps/mobile/tsconfig.json --pretty false
```

Keep this runbook updated whenever typechecking or fetch changes introduce new guardrails.
