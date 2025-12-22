# CI — Supabase Verify Workflow

This repo includes `.github/workflows/verify-supabase.yml` which:
- Boots a local Supabase stack and runs `supabase db reset` + `supabase test db` (smoke tests in `supabase/tests/`)
- Typechecks Edge Functions with `deno check` (catches import/compile issues before deploy)
- Runs `supabase db lint` (static checks)
- Pings `brand-insights-job` and `brand-resolve` using your anon key

Setup
1) In GitHub → Repo → Settings → Actions, ensure workflows are allowed.
2) Add repository secrets:
   - `SUPABASE_PROJECT_REF` = `itokvgjhtqzhrjlzazpm`
   - `SUPABASE_ANON_KEY` = `<your anon token starting with eyJ...>`
3) Push a commit or use “Re-run jobs” to execute the workflow.
4) Windows note: `supabase test db --debug` may print `open supabase\\.temp\\profile: The system cannot find the file specified.`; it’s non-fatal. To silence it, create an empty `supabase/.temp/profile` (directory is gitignored).

Expected
- Both function calls return HTTP 200. The job output includes `{ status, durationMs, records }`.
- If functions return non-200, the job fails.
