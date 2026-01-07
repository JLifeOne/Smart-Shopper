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

const readSchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
    markAll: z.boolean().optional(),
    dismiss: z.boolean().optional()
  })
  .refine((value) => value.markAll || (value.ids && value.ids.length > 0), {
    message: "ids_or_mark_all_required"
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

  if (req.method !== "POST") {
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
    const raw = await req.json().catch(() => ({}));
    const parsed = readSchema.safeParse(raw);
    if (!parsed.success) {
      return respondError({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsed.error.flatten()
      });
    }

    const payload = parsed.data;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { read_at: now };
    if (payload.dismiss) {
      updates.dismissed_at = now;
    }

    let query = client.from("notification_inbox").update(updates).eq("user_id", userId);
    if (!payload.markAll && payload.ids) {
      query = query.in("id", payload.ids);
    }

    const { data, error } = await query.select("id");
    if (error) {
      console.error("notification_inbox update failed", { correlationId, error });
      return respondError({ code: "notification_update_failed", correlationId, status: 400 });
    }

    const updatedCount = data?.length ?? 0;
    logEvent({
      event: "notification_inbox_read",
      correlationId,
      ownerId: userId,
      status: payload.dismiss ? "dismissed" : "read",
      metadata: { updatedCount }
    });

    return respond({ updatedCount, correlationId }, {}, correlationId);
  } catch (error) {
    console.error("notifications-read failure", { correlationId, error });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
