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
    "authorization, x-client-info, apikey, content-type, x-correlation-id"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

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

  if (req.method !== "GET") {
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
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) {
      return errorResponse({ code: "auth_invalid", correlationId, status: 401, corsHeaders });
    }

    const url = new URL(req.url);
    const limitParam = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 20;
    const cursor = url.searchParams.get("cursor");

    let query = client
      .from("notification_inbox")
      .select("id, type, title, body, payload, created_at, read_at, dismissed_at")
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: items, error } = await query;
    if (error) {
      console.error("notification_inbox fetch failed", { correlationId, error });
      return errorResponse({ code: "notifications_fetch_failed", correlationId, status: 400, corsHeaders });
    }

    const { count: unreadCount } = await client
      .from("notification_inbox")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authData.user.id)
      .is("read_at", null);

    const nextCursor = items && items.length === limit ? items[items.length - 1]?.created_at ?? null : null;

    logEvent({
      event: "notification_inbox_listed",
      correlationId,
      ownerId: authData.user.id,
      metadata: { count: items?.length ?? 0 }
    });

    return jsonResponse(
      { items: items ?? [], nextCursor, unreadCount: unreadCount ?? 0, correlationId },
      {},
      corsHeaders,
      correlationId
    );
  } catch (error) {
    console.error("notifications-list failure", { correlationId, error });
    return errorResponse({ code: "internal_error", correlationId, status: 500, corsHeaders });
  }
});
