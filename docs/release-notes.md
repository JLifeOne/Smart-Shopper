# Release Notes

## v0.4 — Western Catalog Expansion (2025-11-09)

### Highlights
- Added ~310 new grocery dictionary rows spanning seven new/expanded categories, bringing the running total to ~1,360 Western food items.
- Introduced `food_dictionary_v0_4` CSV slice and markdown exports (`docs/data/food-dictionary-western-part{1..4}.md`) with alphabetized categories and richer regional alias coverage.
- Regenerated the consolidated catalog (`apps/mobile/src/catalog/data/western-shared.ts`) plus refreshed region bundles (`jm`, `us`, `cn`) to consume the new shared dataset alongside legacy entries.
- Landed a reusable generator (`scripts/generate_western_catalog.py`) plus new shared Supabase dictionary artifacts, simplifying future dataset drops.

### Data & Catalog Details
- Dictionary output: 1,032 machine-ready records emitted to `supabase/functions/_shared/food-dictionary-western-part1.ts`.
- Catalog output: 1,660 sellable records with pricing bands, packaging tokens, and store metadata routed through `apps/mobile/src/catalog/data/western-shared.ts`.
- Category coverage now includes “Ready Meals & Meal Kits,” “Frozen Entrées & Sides,” “Seafood — Canned & Smoked,” “Dairy — Cheeses (More A–Z),” “Condiments — Global Sauces (More),” and “Snacks — Regional Classics (More).”
- Alias completeness: JM/TT/PR/DO/HT/US/CA/MX/BR/CO columns filled where data exists; blanks default to `null` for downstream inference.

### Engineering Notes
- Generator ingests the four markdown slices, normalizes category metadata, and writes both the Supabase dictionary fragments and Expo catalog bundles; rerun via `python3 scripts/generate_western_catalog.py` after edits.
- Shared classifier (`supabase/functions/_shared/hybrid-classifier.ts`) and dictionary wiring updated to reflect the expanded schema/types (`food-dictionary-types.ts`).
- Region bundles (`apps/mobile/src/catalog/data/{jm,us,cn}.ts`) now import the shared catalog export plus their legacy overrides, reducing duplication.

### Validation
- `pnpm verify` (workspace typecheck + JSX sanity) passes.
- `supabase test db` (pgTAP: `brand_phase0.sql`, `brand_price_insights.sql`) passes when run from the Windows PowerShell harness (`C:\ss\supabase`).

### Next Actions
1. Keep regional counts in sync by rerunning the generator whenever new markdown data lands.
2. For v0.5, target additional locale bundles (e.g., CA, MX) using the new shared dataset as the source of truth.
