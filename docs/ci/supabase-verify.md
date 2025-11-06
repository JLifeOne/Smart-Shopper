# CI — Supabase Verify Workflow

This repo includes `.github/workflows/verify-supabase.yml` which:
- Runs `supabase db lint` (static checks)
- Pings `brand-insights-job` and `brand-resolve` using your anon key

Setup
1) In GitHub → Repo → Settings → Actions, ensure workflows are allowed.
2) Add repository secrets:
   - `SUPABASE_PROJECT_REF` = `itokvgjhtqzhrjlzazpm`
   - `SUPABASE_ANON_KEY` = `<your anon token starting with eyJ...>`
3) Push a commit or use “Re-run jobs” to execute the workflow.

Expected
- Both function calls return HTTP 200. The job output includes `{ status, durationMs, records }`.
- If functions return non-200, the job fails.

