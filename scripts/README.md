# Scripts (Toolbox)

These scripts support local development, verification, and repeatable workflows.

## Session / workflow helpers
- `scripts/session_start.mjs` — Prints repo state, what to read, and the local gates to run.

## Mobile sanity checks
- `scripts/run_jsx_sanity_check.mjs` — Runs `scripts/jsx_sanity_check.py` using an available Python executable.
- `scripts/jsx_sanity_check.py` — Lightweight scan for missing commas and duplicate imports (fast, not a linter replacement).

## Windows dev helpers (PowerShell)
- `scripts/windows-rebuild.ps1` — Rebuilds a clean Windows dev environment (stops Metro, removes caches, reinstalls deps).
- `scripts/kill-port.ps1` — Kills processes bound to a port (useful for stuck Metro ports).

## Supabase / feature validation
- `scripts/verify-brand-stack.ps1` — Calls brand edge functions for quick validation (requires project ref + keys).
- `scripts/menu-regenerate.ps1` — Gets a JWT and invokes `menu-regenerate` (requires a user that owns the recipe).

## Catalog generation
- `scripts/generate_western_catalog.py` — Builds shared food dictionaries for Supabase + mobile from `docs/data/*`.
- `scripts/validate_food_dictionary_csv.py` — Validates the CSV blocks in `docs/data/food-dictionary-western-part{2,3,4}.md` are machine-parseable.

## One-off patching
- `scripts/patch_home.py` — One-off patch script used during UI iteration (only run if you understand what it changes).
