# Runbook — Promo Alerts (In‑App + Push Providers)

This runbook describes the **promo alerts** pipeline: in‑app inbox + push delivery (Expo or OneSignal). It is designed for reliability at scale (5M+ users) with strict security boundaries.

## Goals
- In‑app inbox is the source of truth (reliable even if push is disabled).
- Push delivery is optional and respects user preferences + quiet hours + daily caps.
- Internal-only send/dispatch flow (no client access to campaign/delivery writes).

## Data model (Supabase)
- `notification_campaigns`: campaign templates + targeting + status.
- `notification_inbox`: per‑user inbox items (read/dismiss state).
- `notification_deliveries`: per‑user/per‑channel delivery status.
- `notification_devices`: provider‑agnostic device registrations (expo/onesignal).
- `notification_preferences`: opt‑in, quiet hours, daily caps.

## Edge functions
Client‑facing:
- `notifications-register`: device registration (Expo or OneSignal token).
- `notifications-list`: list inbox items + unread count.
- `notifications-read`: mark read/dismiss.
- `notifications-preferences`: read/update preferences.

Internal‑only:
- `notifications-send`: create campaign + enqueue inbox/deliveries.
- `notifications-dispatch`: worker to claim/send push deliveries.

## Security controls (non‑negotiable)
- **Internal key**: `NOTIFICATIONS_INTERNAL_KEY` is required for `notifications-send` and `notifications-dispatch`.
- **Service role**: only server-side functions use `SUPABASE_SERVICE_ROLE_KEY`.
- **RLS**: campaigns/deliveries are service‑only; inbox/preferences/devices are owner‑scoped.
- Never expose the service role key in clients or logs.

## Environment variables
Supabase (edge functions):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATIONS_INTERNAL_KEY`
- `NOTIFICATIONS_PUSH_PROVIDER` (`expo` | `onesignal` | `auto`, default `expo`)
- `NOTIFICATIONS_ONESIGNAL_ENABLED` (`true` to allow OneSignal dispatch; keep `false` in production until ready)
- `ONESIGNAL_APP_ID` (required for OneSignal sends)
- `ONESIGNAL_REST_API_KEY` (required for OneSignal sends)
- `ONESIGNAL_ID_TYPE` (`player` | `subscription`, must match the device ID you store)

Mobile (Expo):
- `EXPO_PUBLIC_EXPO_PROJECT_ID`
- `EXPO_PUBLIC_FEATURE_PROMO_NOTIFICATIONS=true` (feature flag)
- `EXPO_PUBLIC_NOTIFICATIONS_PROVIDER` (`expo` | `onesignal` | `auto`, default `expo`)
- `EXPO_PUBLIC_ONESIGNAL_APP_ID` (required for OneSignal registration)

## Setup checklist
1) Apply migration `0035_notifications_promo_alerts.sql`.
2) Set `NOTIFICATIONS_INTERNAL_KEY` in Supabase Function secrets.
3) Add `EXPO_PUBLIC_EXPO_PROJECT_ID` to `apps/mobile/.env`.
4) Enable `EXPO_PUBLIC_FEATURE_PROMO_NOTIFICATIONS=true` for QA builds.
5) Build dev client (`expo run:android` / `expo run:ios`) — Expo Go does **not** support push.
6) If using OneSignal, set `EXPO_PUBLIC_NOTIFICATIONS_PROVIDER=onesignal` and `EXPO_PUBLIC_ONESIGNAL_APP_ID`, plus server-side `ONESIGNAL_*` secrets.
7) Set `NOTIFICATIONS_ONESIGNAL_ENABLED=true` in non-production environments when validating OneSignal.
8) If using OneSignal, ensure `react-native-onesignal` + `onesignal-expo-plugin` are installed and rebuild the dev client.

## Provider controls (show me the knobs)
- **Server:** `NOTIFICATIONS_PUSH_PROVIDER` controls which provider is used for new push deliveries.
  - `expo`: always use Expo tokens.
  - `onesignal`: always use OneSignal tokens (requires `ONESIGNAL_*`).
  - `auto`: prefer OneSignal when available, otherwise Expo.
- **Server safety:** `NOTIFICATIONS_ONESIGNAL_ENABLED=false` keeps OneSignal unreachable in production by default.
- **ID mapping:** store the OneSignal ID that matches `ONESIGNAL_ID_TYPE` in `notification_devices.provider_subscription_id`.
- **Mobile:** `EXPO_PUBLIC_NOTIFICATIONS_PROVIDER` controls which provider the app registers.
  - Keep `expo` in production until OneSignal is fully validated.
  - Use `onesignal` in staging/dev to validate the free tier.

## Send flow (internal)
`notifications-send` creates a campaign, inbox rows, and delivery rows.
It respects:
- `promos_enabled` (for promo campaigns)
- `push_enabled` (push channel only)
Optional `pushProvider` can override the server default (`expo` | `onesignal` | `auto`) per send.

**PowerShell example (internal only, do not paste real secrets in chat):**
```powershell
$projectRef = "<PROJECT_REF>"
$anonKey = "<ANON_KEY>"
$internalKey = "<INTERNAL_KEY>"

$headers = @{
  apikey = $anonKey
  "Content-Type" = "application/json"
  "x-internal-key" = $internalKey
}

$body = @{
  idempotencyKey = "promo-campaign-001"
  type = "promo"
  title = "Fresh deals"
  body = "Save on pantry staples this week."
  payload = @{ screen = "notifications" }
  target = @{ userIds = @("<USER_UUID>") }
  sendInApp = $true
  sendPush = $true
  pushProvider = "expo"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method POST -Uri "https://$projectRef.supabase.co/functions/v1/notifications-send" `
  -Headers $headers `
  -Body $body
```

## Dispatch flow (internal worker)
`notifications-dispatch` claims pending push deliveries, applies preference checks, and sends push notifications via the configured provider.

**PowerShell example:**
```powershell
$projectRef = "<PROJECT_REF>"
$anonKey = "<ANON_KEY>"
$internalKey = "<INTERNAL_KEY>"

$headers = @{
  apikey = $anonKey
  "Content-Type" = "application/json"
  "x-internal-key" = $internalKey
}

Invoke-RestMethod -Method POST -Uri "https://$projectRef.supabase.co/functions/v1/notifications-dispatch?batchSize=50" `
  -Headers $headers
```

## Common failure modes + responses
- `no_devices`: user has no active Expo tokens → ask user to enable push.
- `push_disabled`: user opted out → do not retry.
- `promos_disabled`: user opted out → do not retry.
- `quiet_hours`: skip until next eligible window.
- `daily_cap`: skip after `max_promos_per_day`.
- `provider_unavailable`: temporary push provider outage → retries use exponential backoff.
- `provider_disabled`: provider requested but disabled/misconfigured → no retry.

## Rollback
1) Disable `feature_promo_notifications` in the mobile env.
2) Pause internal sends (stop calling `notifications-send`).
3) Optionally rotate/clear `NOTIFICATIONS_INTERNAL_KEY` to freeze internal dispatch.

## Verification
- `supabase test db` includes `0032_notifications_promo_alerts.test.sql`.
- Use `notifications-list` and `notifications-read` to validate inbox behavior.
- Ensure correlation IDs appear in logs for send/dispatch.
