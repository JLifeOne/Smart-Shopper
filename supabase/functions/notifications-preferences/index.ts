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

const timeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "invalid_time")
  .transform((value) => (value.length === 5 ? `${value}:00` : value));

const updateSchema = z.object({
  promosEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  quietHoursStart: timeSchema.nullable().optional(),
  quietHoursEnd: timeSchema.nullable().optional(),
  quietHoursTimezone: z.string().min(1).max(64).optional(),
  maxPromosPerDay: z.number().int().min(0).max(20).optional()
});

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

async function getAuthedClient(req: Request) {
  if (!supabaseUrl || !anonKey) throw new Error("supabase_not_configured");
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) throw new Error("auth_required");
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw new Error("auth_invalid");
  return { client, userId: data.user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  if (req.method !== "GET" && req.method !== "PATCH") {
    return respondError({ code: "method_not_allowed", correlationId, status: 405 });
  }

  let client;
  let userId;
  try {
    ({ client, userId } = await getAuthedClient(req));
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return respondError({ code: message, correlationId, status });
  }

  try {
    const { data: existing, error: existingError } = await client
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      console.error("notification_preferences fetch failed", { correlationId, existingError });
      return respondError({ code: "preferences_fetch_failed", correlationId, status: 400 });
    }

    if (req.method === "GET") {
      if (existing) {
        return respond({ preferences: existing, correlationId }, {}, correlationId);
      }
      const { data: created, error: createError } = await client
        .from("notification_preferences")
        .insert({ user_id: userId })
        .select("*")
        .single();
      if (createError || !created) {
        console.error("notification_preferences create failed", { correlationId, createError });
        return respondError({ code: "preferences_create_failed", correlationId, status: 400 });
      }
      return respond({ preferences: created, correlationId }, {}, correlationId);
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return respondError({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const updates = {
      user_id: userId,
      promos_enabled: payload.promosEnabled ?? existing?.promos_enabled ?? true,
      push_enabled: payload.pushEnabled ?? existing?.push_enabled ?? true,
      quiet_hours_start: payload.quietHoursStart ?? existing?.quiet_hours_start ?? null,
      quiet_hours_end: payload.quietHoursEnd ?? existing?.quiet_hours_end ?? null,
      quiet_hours_timezone: payload.quietHoursTimezone ?? existing?.quiet_hours_timezone ?? "UTC",
      max_promos_per_day: payload.maxPromosPerDay ?? existing?.max_promos_per_day ?? 3
    };

    const { data: saved, error: saveError } = await client
      .from("notification_preferences")
      .upsert(updates, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saveError || !saved) {
      console.error("notification_preferences update failed", { correlationId, saveError });
      return respondError({ code: "preferences_update_failed", correlationId, status: 400 });
    }

    logEvent({
      event: "notification_preferences_updated",
      correlationId,
      ownerId: userId,
      status: "updated"
    });

    return respond({ preferences: saved, correlationId }, {}, correlationId);
  } catch (error) {
    console.error("notifications-preferences failure", { correlationId, error });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
