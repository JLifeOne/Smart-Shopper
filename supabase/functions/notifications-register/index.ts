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
    "authorization, x-client-info, apikey, content-type, x-correlation-id"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

const registerSchema = z.object({
  provider: z.enum(["expo", "fcm", "apns", "onesignal"]),
  providerSubscriptionId: z.string().min(1),
  deviceId: z.string().min(1),
  platform: z.enum(["ios", "android", "web"]),
  deviceInfo: z.record(z.unknown()).optional(),
  pushEnabled: z.boolean().optional()
});

function withAuthedClient(req: Request) {
  if (!supabaseUrl || !anonKey) {
    throw new Error("supabase_not_configured");
  }
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) {
    throw new Error("auth_required");
  }
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  return client;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  if (req.method !== "POST") {
    return errorResponse({ code: "method_not_allowed", correlationId, status: 405, corsHeaders });
  }

  let client;
  try {
    client = withAuthedClient(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return errorResponse({ code: message, correlationId, status, corsHeaders });
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsed.error.flatten(),
        corsHeaders
      });
    }

    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return errorResponse({ code: "auth_invalid", correlationId, status: 401, corsHeaders });
    }

    const payload = parsed.data;
    const now = new Date().toISOString();

    const { data: device, error: deviceError } = await client
      .from("notification_devices")
      .upsert(
        {
          user_id: authData.user.id,
          provider: payload.provider,
          provider_subscription_id: payload.providerSubscriptionId,
          device_id: payload.deviceId,
          platform: payload.platform,
          device_info: payload.deviceInfo ?? {},
          is_active: true,
          last_registered_at: now
        },
        { onConflict: "user_id,provider,device_id" }
      )
      .select("id, provider, platform, is_active, last_registered_at")
      .single();

    if (deviceError || !device) {
      console.error("notification_devices upsert failed", { correlationId, deviceError });
      return errorResponse({ code: "device_register_failed", correlationId, status: 400, corsHeaders });
    }

    if (typeof payload.pushEnabled === "boolean") {
      await client
        .from("notification_preferences")
        .upsert(
          {
            user_id: authData.user.id,
            push_enabled: payload.pushEnabled
          },
          { onConflict: "user_id" }
        );
    }

    logEvent({
      event: "notification_device_registered",
      correlationId,
      ownerId: authData.user.id,
      entityId: device.id,
      status: "registered",
      metadata: {
        provider: payload.provider,
        platform: payload.platform
      }
    });

    return jsonResponse({ device, correlationId }, {}, corsHeaders, correlationId);
  } catch (error) {
    console.error("notifications-register failure", { correlationId, error });
    return errorResponse({ code: "internal_error", correlationId, status: 500, corsHeaders });
  }
});
