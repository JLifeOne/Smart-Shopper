# Runbook — Brand Insights Nightly Job

Purpose: refresh aggregated brand pricing insights daily and alert on failures or slow runs.

Scheduling (Supabase Dashboard)
- Navigate: Project → Functions → `brand-insights-job` → Scheduled Triggers → Add.
- Cron: `0 2 * * *` (02:00 daily, project region time).
- Save. Verify a row appears under Scheduled Triggers.

Verification
- On demand: call the function once after saving the schedule.
  - cURL: `curl -i -X POST https://<project-ref>.supabase.co/functions/v1/brand-insights-job \
      -H "authorization: Bearer <anon_or_service>" -H "apikey: <anon>" -H "content-type: application/json" -d '{}'`
- Expect 200 with `{ status: "ok", durationMs, records }` and records ≥ 0.
- Next morning: check Logs → Functions for `brand-insights-job` entries; confirm status 200 and reasonable duration (< 5s typical).

Alerts (lightweight)
- In Dashboard → Logs, create an alert on `brand-insights-job` with:
  - Filter: `function:brand-insights-job AND status >= 500`
  - Action: email your on-call alias.
- Optional performance alert: filter by `durationMs > 5000` (emit in body) or rely on slow log threshold.

Rollback / Disable
- Disable the schedule from the `brand-insights-job` Scheduled Triggers panel.
- If a bad aggregation ran, you can temporarily hide insights in the app via runtime config or feature flags.

Notes
- The function uses a safe `DELETE ... WHERE true` inside `refresh_brand_price_insights()` and is `security definer` scoped.
- For large datasets, consider switching to a materialized view with `refresh materialized view concurrently` and a unique index.

