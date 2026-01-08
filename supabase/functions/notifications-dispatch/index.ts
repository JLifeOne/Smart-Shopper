import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import {
  errorResponse,
  getCorrelationId,
  jsonResponse,
  logEvent
} from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-internal-key"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const internalKey = Deno.env.get("NOTIFICATIONS_INTERNAL_KEY");
const pushProviderEnv = (Deno.env.get("NOTIFICATIONS_PUSH_PROVIDER") ?? "").toLowerCase();
const pushProviderDefault =
  pushProviderEnv === "expo" || pushProviderEnv === "onesignal" || pushProviderEnv === "auto"
    ? pushProviderEnv
    : "expo";
const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
const oneSignalApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
const oneSignalIdTypeRaw = (Deno.env.get("ONESIGNAL_ID_TYPE") ?? "").toLowerCase();
const oneSignalIdType =
  oneSignalIdTypeRaw === "player" || oneSignalIdTypeRaw === "subscription"
    ? oneSignalIdTypeRaw
    : null;
// Explicit kill switch to keep OneSignal disabled until the rollout is approved.
const oneSignalAllowed = (Deno.env.get("NOTIFICATIONS_ONESIGNAL_ENABLED") ?? "").toLowerCase() === "true";
const oneSignalEnabled = Boolean(oneSignalAllowed && oneSignalAppId && oneSignalApiKey && oneSignalIdType);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const ONESIGNAL_PUSH_URL = "https://onesignal.com/api/v1/notifications";

type DeliveryRow = {
  id: string;
  inbox_id: string;
  user_id: string;
  attempt_count: number;
  provider: string | null;
};

type InboxRow = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
};

type PreferenceRow = {
  user_id: string;
  promos_enabled: boolean | null;
  push_enabled: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
  max_promos_per_day: number | null;
};

type DeviceRow = {
  user_id: string;
  provider_subscription_id: string;
  provider: string;
  is_active: boolean | null;
};

type PushProvider = "expo" | "onesignal";

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

function authorizeInternalCall(req: Request) {
  if (!internalKey || !internalKey.trim().length) {
    return { ok: false as const, error: "notifications_service_disabled" };
  }
  const provided = req.headers.get("x-internal-key") ?? "";
  if (provided !== internalKey) {
    return { ok: false as const, error: "forbidden" };
  }
  return { ok: true as const };
}

function getServiceClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("supabase_not_configured");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function parseTimeParts(value: string) {
  const [hour, minute] = value.split(":");
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return null;
  }
  return { h, m };
}

function getLocalTime(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    });
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return { h: hour, m: minute };
  } catch {
    return null;
  }
}

function isWithinQuietHours(
  now: Date,
  start: string | null,
  end: string | null,
  timeZone: string | null
) {
  if (!start || !end) return false;
  const startParts = parseTimeParts(start);
  const endParts = parseTimeParts(end);
  if (!startParts || !endParts) return false;
  const local = getLocalTime(now, timeZone ?? "UTC") ?? getLocalTime(now, "UTC");
  if (!local) return false;
  const currentMinutes = local.h * 60 + local.m;
  const startMinutes = startParts.h * 60 + startParts.m;
  const endMinutes = endParts.h * 60 + endParts.m;
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function computeNextRetry(attemptCount: number) {
  const baseMs = 60 * 1000;
  const maxMs = 30 * 60 * 1000;
  const nextMs = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attemptCount - 1)));
  return new Date(Date.now() + nextMs).toISOString();
}

function normalizeProvider(value: string | null | undefined): PushProvider | null {
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (lowered === "expo" || lowered === "onesignal") {
    return lowered;
  }
  return null;
}

async function sendExpoPush(messages: Array<Record<string, unknown>>) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(messages)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error("expo_push_failed");
  }
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data;
}

async function sendOneSignalPush(input: {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  if (!oneSignalEnabled || !oneSignalAppId || !oneSignalApiKey || !oneSignalIdType) {
    throw new Error("onesignal_disabled");
  }
  const payload: Record<string, unknown> = {
    app_id: oneSignalAppId,
    headings: { en: input.title },
    contents: { en: input.body },
    data: input.data
  };
  if (oneSignalIdType === "subscription") {
    payload.include_subscription_ids = input.tokens;
  } else {
    payload.include_player_ids = input.tokens;
  }
  const response = await fetch(ONESIGNAL_PUSH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Basic ${oneSignalApiKey}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const errorValue = result?.errors ?? result?.error ?? "onesignal_push_failed";
    throw new Error(Array.isArray(errorValue) ? errorValue.join(",") : String(errorValue));
  }
  const invalidPlayerIds = Array.isArray(result?.invalid_player_ids) ? result.invalid_player_ids : [];
  const invalidSubscriptionIds = Array.isArray(result?.invalid_subscription_ids)
    ? result.invalid_subscription_ids
    : [];
  const errors = Array.isArray(result?.errors)
    ? result.errors.map(String)
    : result?.errors
      ? [String(result.errors)]
      : [];
  return {
    id: result?.id ?? null,
    recipients: Number(result?.recipients ?? 0),
    errors,
    invalidTokens: [...invalidPlayerIds, ...invalidSubscriptionIds],
    raw: result
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  if (req.method !== "POST") {
    return respondError({ code: "method_not_allowed", correlationId, status: 405 });
  }

  const auth = authorizeInternalCall(req);
  if (!auth.ok) {
    return respondError({
      code: auth.error,
      correlationId,
      status: auth.error === "forbidden" ? 403 : 503
    });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : "supabase_not_configured";
    return respondError({ code: message, correlationId, status: 500 });
  }

  try {
    const url = new URL(req.url);
    const batchSize = Number(url.searchParams.get("batchSize") ?? 50);
    const limit = Number.isFinite(batchSize) ? Math.max(1, Math.min(200, batchSize)) : 50;

    const { data: claimed, error: claimError } = await supabase.rpc("claim_notification_deliveries", {
      batch_size: limit
    });
    if (claimError) {
      console.error("notification deliveries claim failed", { correlationId, claimError });
      return respondError({ code: "delivery_claim_failed", correlationId, status: 400 });
    }

    const deliveries = (claimed ?? []) as DeliveryRow[];
    if (!deliveries.length) {
      return respond({ processed: 0, correlationId }, {}, correlationId);
    }

    const inboxIds = deliveries.map((row) => row.inbox_id);
    const userIds = Array.from(new Set(deliveries.map((row) => row.user_id)));

    const [{ data: inbox }, { data: preferences }, { data: devices }, countsResult] = await Promise.all([
      supabase
        .from("notification_inbox")
        .select("id, user_id, campaign_id, type, title, body, payload")
        .in("id", inboxIds),
      supabase
        .from("notification_preferences")
        .select(
          "user_id, promos_enabled, push_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, max_promos_per_day"
        )
        .in("user_id", userIds),
      supabase
        .from("notification_devices")
        .select("user_id, provider_subscription_id, provider, is_active")
        .in("provider", ["expo", "onesignal"])
        .eq("is_active", true)
        .in("user_id", userIds),
      supabase.rpc("notification_daily_push_counts", { user_ids: userIds })
    ]);

    if (countsResult?.error) {
      console.error("notification_daily_push_counts failed", { correlationId, error: countsResult.error });
    }

    const inboxById = new Map((inbox ?? []).map((row) => [row.id, row as InboxRow]));
    const prefsByUser = new Map((preferences ?? []).map((row) => [row.user_id, row as PreferenceRow]));
    const devicesByUser = new Map<string, Map<PushProvider, string[]>>();
    (devices ?? []).forEach((row) => {
      const provider = normalizeProvider((row as DeviceRow).provider);
      if (!provider || !(row as DeviceRow).provider_subscription_id) {
        return;
      }
      const userMap = devicesByUser.get(row.user_id) ?? new Map<PushProvider, string[]>();
      const list = userMap.get(provider) ?? [];
      list.push((row as DeviceRow).provider_subscription_id);
      userMap.set(provider, list);
      devicesByUser.set(row.user_id, userMap);
    });
    const getTokensFor = (userId: string, provider: PushProvider) =>
      devicesByUser.get(userId)?.get(provider) ?? [];
    const countByUser = new Map(
      Array.isArray(countsResult?.data)
        ? countsResult.data.map((row: { user_id: string; sent_count: number }) => [row.user_id, row.sent_count])
        : []
    );

    const now = new Date();
    const expoMessages: Array<Record<string, unknown>> = [];
    const expoByToken = new Map<string, { deliveryId: string; userId: string }>();
    const oneSignalPlans: Array<{ delivery: DeliveryRow; inboxItem: InboxRow; tokens: string[] }> = [];
    const providerByDelivery = new Map<string, PushProvider>();
    const deliveryUpdates: Array<Promise<void>> = [];
    const queueDeliveryUpdate = (
      deliveryId: string,
      patch: Record<string, unknown>,
      context?: { status?: string; errorCode?: string | null; provider?: string | null }
    ) => {
      deliveryUpdates.push(
        (async () => {
          const { error } = await supabase
            .from("notification_deliveries")
            .update(patch)
            .eq("id", deliveryId);
          if (error) {
            logEvent({
              event: "notification_delivery_update_failed",
              correlationId,
              entityId: deliveryId,
              status: context?.status,
              errorCode: context?.errorCode ?? "update_failed",
              metadata: {
                provider: context?.provider ?? undefined,
                fields: Object.keys(patch)
              }
            });
            throw error;
          }
        })()
      );
    };
    const handledDeliveryIds = new Set<string>();
    const invalidExpoTokens: string[] = [];
    const invalidOneSignalTokens: string[] = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const delivery of deliveries) {
      const inboxItem = inboxById.get(delivery.inbox_id);
      if (!inboxItem) {
        queueDeliveryUpdate(
          delivery.id,
          { status: "failed", error_code: "inbox_missing" },
          { status: "failed", errorCode: "inbox_missing" }
        );
        handledDeliveryIds.add(delivery.id);
        failedCount += 1;
        continue;
      }

      const prefs = prefsByUser.get(delivery.user_id);
      const promosEnabled = prefs?.promos_enabled ?? true;
      const pushEnabled = prefs?.push_enabled ?? true;
      const maxPromosPerDay = prefs?.max_promos_per_day ?? 3;
      const dailySent = countByUser.get(delivery.user_id) ?? 0;

      if (inboxItem.type === "promo" && !promosEnabled) {
        queueDeliveryUpdate(
          delivery.id,
          { status: "skipped", error_code: "promos_disabled" },
          { status: "skipped", errorCode: "promos_disabled" }
        );
        handledDeliveryIds.add(delivery.id);
        skippedCount += 1;
        continue;
      }

      if (!pushEnabled) {
        queueDeliveryUpdate(
          delivery.id,
          { status: "skipped", error_code: "push_disabled" },
          { status: "skipped", errorCode: "push_disabled" }
        );
        handledDeliveryIds.add(delivery.id);
        skippedCount += 1;
        continue;
      }

      if (inboxItem.type === "promo" && dailySent >= maxPromosPerDay) {
        queueDeliveryUpdate(
          delivery.id,
          { status: "skipped", error_code: "daily_cap" },
          { status: "skipped", errorCode: "daily_cap" }
        );
        handledDeliveryIds.add(delivery.id);
        skippedCount += 1;
        continue;
      }

      if (isWithinQuietHours(now, prefs?.quiet_hours_start ?? null, prefs?.quiet_hours_end ?? null, prefs?.quiet_hours_timezone ?? "UTC")) {
        queueDeliveryUpdate(
          delivery.id,
          { status: "skipped", error_code: "quiet_hours" },
          { status: "skipped", errorCode: "quiet_hours" }
        );
        handledDeliveryIds.add(delivery.id);
        skippedCount += 1;
        continue;
      }

      const oneSignalTokens = getTokensFor(delivery.user_id, "onesignal");
      const expoTokens = getTokensFor(delivery.user_id, "expo");
      const explicitProvider = normalizeProvider(delivery.provider);
      const configuredProvider = pushProviderDefault === "auto" ? "auto" : (pushProviderDefault as PushProvider);
      const requestedProvider =
        explicitProvider ?? (configuredProvider === "auto" ? null : (configuredProvider as PushProvider));

      let selectedProvider: PushProvider | null = null;
      let selectedTokens: string[] = [];
      let providerDisabled = false;

      if (explicitProvider) {
        if (explicitProvider === "onesignal" && !oneSignalEnabled) {
          providerDisabled = true;
        } else {
          selectedProvider = explicitProvider;
          selectedTokens = explicitProvider === "onesignal" ? oneSignalTokens : expoTokens;
        }
      } else if (configuredProvider !== "auto") {
        if (configuredProvider === "onesignal" && !oneSignalEnabled) {
          providerDisabled = true;
        } else {
          selectedProvider = configuredProvider as PushProvider;
          selectedTokens = configuredProvider === "onesignal" ? oneSignalTokens : expoTokens;
        }
      } else {
        if (oneSignalEnabled && oneSignalTokens.length) {
          selectedProvider = "onesignal";
          selectedTokens = oneSignalTokens;
        } else if (expoTokens.length) {
          selectedProvider = "expo";
          selectedTokens = expoTokens;
        } else if (!oneSignalEnabled && oneSignalTokens.length) {
          providerDisabled = true;
        }
      }

      if (!selectedProvider) {
        const errorCode = providerDisabled ? "provider_disabled" : "no_devices";
        queueDeliveryUpdate(
          delivery.id,
          {
            status: "skipped",
            error_code: errorCode,
            provider: requestedProvider
          },
          { status: "skipped", errorCode, provider: requestedProvider }
        );
        handledDeliveryIds.add(delivery.id);
        skippedCount += 1;
        continue;
      }

      if (!selectedTokens.length) {
        queueDeliveryUpdate(
          delivery.id,
          {
            status: "skipped",
            error_code: "no_devices",
            provider: selectedProvider
          },
          { status: "skipped", errorCode: "no_devices", provider: selectedProvider }
        );
        handledDeliveryIds.add(delivery.id);
        skippedCount += 1;
        continue;
      }

      providerByDelivery.set(delivery.id, selectedProvider);

      if (selectedProvider === "expo") {
        selectedTokens.forEach((token) => {
          expoMessages.push({
            to: token,
            title: inboxItem.title,
            body: inboxItem.body,
            sound: "default",
            data: {
              inboxId: inboxItem.id,
              campaignId: inboxItem.campaign_id,
              type: inboxItem.type,
              ...inboxItem.payload
            }
          });
          expoByToken.set(token, { deliveryId: delivery.id, userId: delivery.user_id });
        });
      } else {
        oneSignalPlans.push({
          delivery,
          inboxItem,
          tokens: selectedTokens
        });
      }
    }

    let providerFailure = false;
    const expoChunkSize = 100;
    const expoResultsByToken = new Map<string, any>();

    if (expoMessages.length) {
      try {
        for (let i = 0; i < expoMessages.length; i += expoChunkSize) {
          const chunk = expoMessages.slice(i, i + expoChunkSize);
          const chunkResults = await sendExpoPush(chunk);
          chunkResults.forEach((result: any, idx: number) => {
            const token = chunk[idx]?.to;
            if (token) {
              expoResultsByToken.set(token, result);
            }
          });
        }
      } catch (error) {
        providerFailure = true;
        deliveries.forEach((delivery) => {
          if (handledDeliveryIds.has(delivery.id)) {
            return;
          }
          if (providerByDelivery.get(delivery.id) !== "expo") {
            return;
          }
          handledDeliveryIds.add(delivery.id);
          failedCount += 1;
          const retryAt = computeNextRetry(delivery.attempt_count);
          queueDeliveryUpdate(
            delivery.id,
            {
              status: "failed",
              error_code: "provider_unavailable",
              next_retry_at: retryAt,
              provider: "expo"
            },
            { status: "failed", errorCode: "provider_unavailable", provider: "expo" }
          );
        });
        logEvent({
          event: "notification_dispatch_batch",
          correlationId,
          status: "failed",
          errorCode: "provider_unavailable",
          metadata: { processed: deliveries.length, provider: "expo" }
        });
        console.error("notifications-dispatch expo push failed", { correlationId, error });
      }
    }

    const expoDeliveryResultMap = new Map<string, { ok: number; errors: string[] }>();
    for (const [token, result] of expoResultsByToken.entries()) {
      const mapping = expoByToken.get(token);
      if (!mapping) continue;
      const summary = expoDeliveryResultMap.get(mapping.deliveryId) ?? { ok: 0, errors: [] };
      if (result?.status === "ok") {
        summary.ok += 1;
      } else {
        const errorCode = result?.details?.error ?? "unknown";
        summary.errors.push(errorCode);
        if (errorCode === "DeviceNotRegistered") {
          invalidExpoTokens.push(token);
        }
      }
      expoDeliveryResultMap.set(mapping.deliveryId, summary);
    }

    for (const delivery of deliveries) {
      if (handledDeliveryIds.has(delivery.id)) {
        continue;
      }
      if (providerByDelivery.get(delivery.id) !== "expo") {
        continue;
      }
      const summary = expoDeliveryResultMap.get(delivery.id);
      if (!summary) {
        handledDeliveryIds.add(delivery.id);
        failedCount += 1;
        queueDeliveryUpdate(
          delivery.id,
          {
            status: "failed",
            error_code: "provider_unavailable",
            next_retry_at: computeNextRetry(delivery.attempt_count),
            provider: "expo"
          },
          { status: "failed", errorCode: "provider_unavailable", provider: "expo" }
        );
        continue;
      }
      if (summary.ok > 0) {
        queueDeliveryUpdate(
          delivery.id,
          {
            status: "sent",
            provider_response: { ok: summary.ok, errors: summary.errors },
            provider: "expo"
          },
          { status: "sent", provider: "expo" }
        );
        handledDeliveryIds.add(delivery.id);
        sentCount += 1;
        logEvent({
          event: "notification_delivery_sent",
          correlationId,
          ownerId: delivery.user_id,
          entityId: delivery.id,
          status: "sent",
          metadata: { provider: "expo" }
        });
      } else {
        const errorCode = summary.errors[0] ?? "delivery_failed";
        const nextRetryAt = errorCode === "DeviceNotRegistered" ? null : computeNextRetry(delivery.attempt_count);
        const status = errorCode === "DeviceNotRegistered" ? "skipped" : "failed";
        queueDeliveryUpdate(
          delivery.id,
          {
            status,
            error_code: errorCode,
            next_retry_at: nextRetryAt,
            provider: "expo"
          },
          { status, errorCode, provider: "expo" }
        );
        handledDeliveryIds.add(delivery.id);
        if (errorCode === "DeviceNotRegistered") {
          skippedCount += 1;
        } else {
          failedCount += 1;
        }
        logEvent({
          event: "notification_delivery_failed",
          correlationId,
          ownerId: delivery.user_id,
          entityId: delivery.id,
          status: errorCode === "DeviceNotRegistered" ? "skipped" : "failed",
          errorCode,
          metadata: { provider: "expo" }
        });
      }
    }

    if (oneSignalPlans.length) {
      for (const plan of oneSignalPlans) {
        if (handledDeliveryIds.has(plan.delivery.id)) {
          continue;
        }
        const payloadData = {
          inboxId: plan.inboxItem.id,
          campaignId: plan.inboxItem.campaign_id,
          type: plan.inboxItem.type,
          ...plan.inboxItem.payload
        };
        const chunkSize = 2000;
        const invalidForDelivery = new Set<string>();
        const errors: string[] = [];
        let recipients = 0;
        try {
          for (let i = 0; i < plan.tokens.length; i += chunkSize) {
            const chunk = plan.tokens.slice(i, i + chunkSize);
            const result = await sendOneSignalPush({
              tokens: chunk,
              title: plan.inboxItem.title,
              body: plan.inboxItem.body,
              data: payloadData
            });
            recipients += result.recipients;
            errors.push(...result.errors);
            result.invalidTokens.forEach((token) => invalidForDelivery.add(token));
          }
          invalidForDelivery.forEach((token) => invalidOneSignalTokens.push(token));

          const deliveredTokens = plan.tokens.filter((token) => !invalidForDelivery.has(token));
          if (deliveredTokens.length) {
            queueDeliveryUpdate(
              plan.delivery.id,
              {
                status: "sent",
                provider_response: {
                  recipients,
                  errors,
                  invalidTokens: Array.from(invalidForDelivery)
                },
                provider: "onesignal"
              },
              { status: "sent", provider: "onesignal" }
            );
            handledDeliveryIds.add(plan.delivery.id);
            sentCount += 1;
            logEvent({
              event: "notification_delivery_sent",
              correlationId,
              ownerId: plan.delivery.user_id,
              entityId: plan.delivery.id,
              status: "sent",
              metadata: { provider: "onesignal" }
            });
          } else {
            queueDeliveryUpdate(
              plan.delivery.id,
              {
                status: "skipped",
                error_code: "DeviceNotRegistered",
                provider_response: {
                  recipients,
                  errors,
                  invalidTokens: Array.from(invalidForDelivery)
                },
                provider: "onesignal"
              },
              { status: "skipped", errorCode: "DeviceNotRegistered", provider: "onesignal" }
            );
            handledDeliveryIds.add(plan.delivery.id);
            skippedCount += 1;
            logEvent({
              event: "notification_delivery_failed",
              correlationId,
              ownerId: plan.delivery.user_id,
              entityId: plan.delivery.id,
              status: "skipped",
              errorCode: "DeviceNotRegistered",
              metadata: { provider: "onesignal" }
            });
          }
        } catch (error) {
          const errorCode = error instanceof Error ? error.message : "provider_unavailable";
          const isDisabled = errorCode === "onesignal_disabled";
          const nextRetryAt = isDisabled ? null : computeNextRetry(plan.delivery.attempt_count);
          providerFailure = providerFailure || !isDisabled;
          const status = isDisabled ? "skipped" : "failed";
          const resolvedErrorCode = isDisabled ? "provider_disabled" : errorCode;
          queueDeliveryUpdate(
            plan.delivery.id,
            {
              status,
              error_code: resolvedErrorCode,
              next_retry_at: nextRetryAt,
              provider: "onesignal"
            },
            { status, errorCode: resolvedErrorCode, provider: "onesignal" }
          );
          handledDeliveryIds.add(plan.delivery.id);
          if (isDisabled) {
            skippedCount += 1;
          } else {
            failedCount += 1;
          }
          logEvent({
            event: "notification_delivery_failed",
            correlationId,
            ownerId: plan.delivery.user_id,
            entityId: plan.delivery.id,
            status,
            errorCode: resolvedErrorCode,
            metadata: { provider: "onesignal" }
          });
        }
      }
    }

    if (invalidExpoTokens.length) {
      await supabase
        .from("notification_devices")
        .update({ is_active: false })
        .eq("provider", "expo")
        .in("provider_subscription_id", Array.from(new Set(invalidExpoTokens)));
    }

    if (invalidOneSignalTokens.length) {
      await supabase
        .from("notification_devices")
        .update({ is_active: false })
        .eq("provider", "onesignal")
        .in("provider_subscription_id", Array.from(new Set(invalidOneSignalTokens)));
    }

    await Promise.all(deliveryUpdates);

    logEvent({
      event: "notification_dispatch_batch",
      correlationId,
      status: providerFailure ? "failed" : "processed",
      errorCode: providerFailure ? "provider_unavailable" : undefined,
      metadata: {
        processed: deliveries.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount
      }
    });

    const responsePayload = {
      processed: deliveries.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      correlationId
    };

    if (providerFailure) {
      return respondError({ code: "provider_unavailable", correlationId, status: 502, details: responsePayload });
    }

    return respond(responsePayload, {}, correlationId);
  } catch (error) {
    console.error("notifications-dispatch failure", { correlationId, error });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
