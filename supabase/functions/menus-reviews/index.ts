import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Idempotency-Key, x-correlation-id"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type ReviewPayload = {
  sessionId?: string | null;
  cardId?: string | null;
  dishTitle?: string | null;
  reason?: string | null;
  note?: string | null;
};

type ReviewRecord = {
  id: string;
  status: string;
  card_id: string | null;
  session_id: string | null;
  dish_title: string | null;
  reason: string | null;
  note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init
  });
}

function getCorrelationId(req: Request) {
  return (
    req.headers.get("x-correlation-id") ??
    req.headers.get("Idempotency-Key") ??
    crypto.randomUUID()
  );
}

function getIdempotencyKey(req: Request) {
  return req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
}

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

  let supabase;
  let userId;
  try {
    ({ client: supabase, userId } = await getAuthedClient(req));
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return jsonResponse({ error: message, correlationId }, { status });
  }

  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const cardId = url.searchParams.get("cardId");
      const sessionId = url.searchParams.get("sessionId");
      const { data, error } = await supabase
        .from("menu_review_queue")
        .select("id, status, card_id, session_id, dish_title, reason, note, created_at, reviewed_at")
        .eq("owner_id", userId);
      if (error) {
        console.error("menu_review_queue fetch failed", error);
        return jsonResponse({ items: [] });
      }
      const items = Array.isArray(data) ? (data as ReviewRecord[]) : [];
      const filtered = items.filter((item) => {
        if (cardId && item.card_id !== cardId) return false;
        if (sessionId && item.session_id !== sessionId) return false;
        return true;
      });
      return jsonResponse({ items: filtered });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed", correlationId }, { status: 405 });
    }

    const payload = (await req.json().catch(() => ({}))) as ReviewPayload;
    const now = new Date().toISOString();

    const idempotencyKey = getIdempotencyKey(req);
    if (!idempotencyKey) {
      return jsonResponse({ error: "idempotency_key_required", correlationId }, { status: 400 });
    }

    const existing = await supabase
      .from("menu_review_queue")
      .select("id, status, card_id, session_id, dish_title, reason, note, created_at, reviewed_at")
      .eq("owner_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (!existing.error && existing.data) {
      return jsonResponse({
        status: existing.data.status ?? "queued",
        item: existing.data,
        replay: true,
        correlationId
      });
    }

    const { data, error } = await supabase
      .from("menu_review_queue")
      .insert({
        owner_id: userId,
        idempotency_key: idempotencyKey,
        session_id: payload.sessionId ?? null,
        card_id: payload.cardId ?? null,
        dish_title: payload.dishTitle ?? null,
        reason: payload.reason ?? "flagged",
        note: payload.note ?? null,
        status: "pending",
        created_at: now
      })
      .select("id, status, card_id, session_id, dish_title, reason, note, created_at, reviewed_at")
      .single();

    if (error) {
      console.error("menu_review_queue insert failed", error);
      if ((error as any)?.code === "23505") {
        const { data: replay } = await supabase
          .from("menu_review_queue")
          .select("id, status, card_id, session_id, dish_title, reason, note, created_at, reviewed_at")
          .eq("owner_id", userId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (replay) {
          return jsonResponse({ status: replay.status ?? "queued", item: replay, replay: true, correlationId });
        }
      }
    }

    console.log(
      JSON.stringify({
        event: "menu_review_flag",
        userId,
        sessionId: payload.sessionId ?? null,
        cardId: payload.cardId ?? null,
        reason: payload.reason ?? "flagged",
        logged: !error
      })
    );

    return jsonResponse({ status: "queued", item: data ?? null, correlationId });
  } catch (error) {
    console.error("menus-reviews failure", { correlationId, error });
    return jsonResponse({ error: "internal_error", correlationId }, { status: 500 });
  }
});
