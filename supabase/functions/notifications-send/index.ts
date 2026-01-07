import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
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

const sendSchema = z
  .object({
    idempotencyKey: z.string().trim().min(1).max(255).optional(),
    type: z.enum(["promo", "system", "info"]).default("promo"),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(500),
    payload: z.record(z.unknown()).optional().default({}),
    target: z.object({
      userIds: z.array(z.string().uuid()).min(1)
    }),
    sendInApp: z.boolean().optional().default(true),
    sendPush: z.boolean().optional().default(true),
    scheduledFor: z.string().datetime().optional(),
    pushProvider: z.enum(["expo", "onesignal", "auto"]).optional()
  })
  .refine((value) => value.sendInApp || value.sendPush, {
    message: "channel_required"
  });

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
    const raw = await req.json().catch(() => ({}));
    const parsed = sendSchema.safeParse(raw);
    if (!parsed.success) {
      return respondError({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const targetUserIds = payload.target.userIds;
    const pushProvider = payload.pushProvider ?? pushProviderDefault;
    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, promos_enabled, push_enabled")
      .in("user_id", targetUserIds);

    if (prefsError) {
      console.error("notification_preferences fetch failed", { correlationId, prefsError });
      return respondError({ code: "preferences_fetch_failed", correlationId, status: 400 });
    }

    const prefsByUser = new Map(
      (prefs ?? []).map((row) => [
        row.user_id,
        {
          promosEnabled: row.promos_enabled ?? true,
          pushEnabled: row.push_enabled ?? true
        }
      ])
    );

    const eligibleUserIds = targetUserIds.filter((userId) => {
      if (payload.type !== "promo") {
        return true;
      }
      const pref = prefsByUser.get(userId);
      return pref ? pref.promosEnabled : true;
    });

    if (!eligibleUserIds.length) {
      return respond({
        campaignId: null,
        inboxCount: 0,
        deliveryCount: 0,
        correlationId
      }, {}, correlationId);
    }

    let campaignId: string | null = null;
    let isReplay = false;
    if (payload.idempotencyKey) {
      const { data: existingCampaign } = await supabase
        .from("notification_campaigns")
        .select("id")
        .eq("idempotency_key", payload.idempotencyKey)
        .maybeSingle();
      if (existingCampaign?.id) {
        campaignId = existingCampaign.id;
        isReplay = true;
      }
    }

    if (!campaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from("notification_campaigns")
        .insert({
          type: payload.type,
          title: payload.title,
          body: payload.body,
          payload: payload.payload ?? {},
          target: payload.target,
          status: payload.sendPush ? "queued" : "sent",
          idempotency_key: payload.idempotencyKey ?? null,
          scheduled_for: payload.scheduledFor ?? null
        })
        .select("id")
        .single();
      if (campaignError || !campaign) {
        console.error("notification_campaigns insert failed", { correlationId, campaignError });
        return respondError({ code: "campaign_create_failed", correlationId, status: 400 });
      }
      campaignId = campaign.id;
    }

    if (!campaignId) {
      return respondError({ code: "campaign_create_failed", correlationId, status: 400 });
    }

    if (isReplay) {
      const { data: replayInbox } = await supabase
        .from("notification_inbox")
        .select("id")
        .eq("campaign_id", campaignId);
      const inboxIds = (replayInbox ?? []).map((row) => row.id);
      const inboxCount = inboxIds.length;
      const { count: deliveryCount } = inboxIds.length
        ? await supabase
            .from("notification_deliveries")
            .select("id", { count: "exact", head: true })
            .in("inbox_id", inboxIds)
        : { count: 0 };
      return respond(
        {
          campaignId,
          inboxCount: inboxCount ?? 0,
          deliveryCount: deliveryCount ?? 0,
          replay: true,
          correlationId
        },
        {},
        correlationId
      );
    }

    const inboxRows = eligibleUserIds.map((userId) => ({
      user_id: userId,
      campaign_id: campaignId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      payload: payload.payload ?? {}
    }));

    const { data: inboxItems, error: inboxError } = await supabase
      .from("notification_inbox")
      .upsert(inboxRows, { onConflict: "user_id,campaign_id" })
      .select("id, user_id");
    if (inboxError) {
      console.error("notification_inbox upsert failed", { correlationId, inboxError });
      return respondError({ code: "inbox_create_failed", correlationId, status: 400 });
    }

    const inboxItemsSafe = inboxItems ?? [];
    const pushEligibleUserIds = payload.sendPush
      ? eligibleUserIds.filter((userId) => {
          const pref = prefsByUser.get(userId);
          return pref ? pref.pushEnabled : true;
        })
      : [];

    const deliveryRows = inboxItemsSafe.flatMap((item) => {
      const rows: Array<Record<string, unknown>> = [];
      if (payload.sendInApp) {
        rows.push({
          inbox_id: item.id,
          user_id: item.user_id,
          channel: "in_app",
          status: "sent"
        });
      }
      if (payload.sendPush && pushEligibleUserIds.includes(item.user_id)) {
        rows.push({
          inbox_id: item.id,
          user_id: item.user_id,
          channel: "push",
          provider: pushProvider === "auto" ? null : pushProvider,
          status: "pending"
        });
      }
      return rows;
    });

    let deliveryCount = 0;
    if (deliveryRows.length) {
      const { data: deliveries, error: deliveryError } = await supabase
        .from("notification_deliveries")
        .upsert(deliveryRows, { onConflict: "inbox_id,channel" })
        .select("id");
      if (deliveryError) {
        console.error("notification_deliveries upsert failed", { correlationId, deliveryError });
        return respondError({ code: "delivery_create_failed", correlationId, status: 400 });
      }
      deliveryCount = deliveries?.length ?? 0;
    }

    logEvent({
      event: "notification_campaign_queued",
      correlationId,
      status: payload.sendPush ? "queued" : "sent",
      metadata: {
        campaignId,
        type: payload.type,
        inboxCount: inboxItemsSafe.length,
        deliveryCount,
        pushProvider
      }
    });

    return respond(
      {
        campaignId,
        inboxCount: inboxItemsSafe.length,
        deliveryCount,
        pushProvider,
        correlationId
      },
      {},
      correlationId
    );
  } catch (error) {
    console.error("notifications-send failure", { correlationId, error });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
