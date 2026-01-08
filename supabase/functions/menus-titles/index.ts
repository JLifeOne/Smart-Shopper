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
    "authorization, x-client-info, apikey, content-type, Idempotency-Key, x-correlation-id",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

const idempotencyKeySchema = z.string().trim().min(1).max(255);
const createTitleSchema = z.object({
  title: z.string().trim().min(1, "title_required").max(160),
  sessionId: z.string().uuid().optional().nullable(),
});

type TitleDish = {
  id: string;
  title: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
};

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

function requireIdempotencyKey(req: Request) {
  const key = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  const parsed = idempotencyKeySchema.safeParse(key);
  if (!parsed.success) {
    return { key: null };
  }
  return { key: parsed.data };
}

async function getAuthedClient(req: Request) {
  if (!supabaseUrl || !anonKey) throw new Error("supabase_not_configured");
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) throw new Error("auth_required");
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
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
  const startedAt = performance.now();

  let supabase;
  let userId;
  try {
    ({ client: supabase, userId } = await getAuthedClient(req));
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return respondError({ code: message, correlationId, status });
  }

  try {
    if (req.method === "GET") {
      const sessionId = new URL(req.url).searchParams.get("sessionId");
      let query = supabase
        .from("menu_title_dishes")
        .select("id, title, session_id, created_at, updated_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (sessionId) {
        query = query.eq("session_id", sessionId);
      }
      const { data, error } = await query;
      if (error) {
        console.error("menu_title_dishes fetch failed", { correlationId, error });
        return respond({ items: [], correlationId }, {}, correlationId);
      }
      return respond({ items: (data as TitleDish[]) ?? [], correlationId }, {}, correlationId);
    }

    if (req.method !== "POST") {
      return respondError({ code: "method_not_allowed", correlationId, status: 405 });
    }

    const { key: idempotencyKey } = requireIdempotencyKey(req);
    if (!idempotencyKey) {
      return respondError({ code: "idempotency_key_required", correlationId, status: 400 });
    }

    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = createTitleSchema.safeParse(raw);
    if (!parsed.success) {
      return respondError({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsed.error.flatten()
      });
    }

    const { data: created, error: createError } = await supabase.rpc(
      "menu_create_title_dish",
      {
        _idempotency_key: idempotencyKey,
        _title: parsed.data.title,
        _session_id: parsed.data.sessionId ?? null,
      },
    );
    if (createError) {
      const message = createError.message ?? "title_create_failed";
      if (message.includes("limit_exceeded")) {
        logEvent({
          event: "menu_title_dish_limit_exceeded",
          correlationId,
          ownerId: userId,
          errorCode: "limit_exceeded",
          metadata: { scope: "uploads" }
        });
        return respondError({
          code: "limit_exceeded",
          correlationId,
          status: 429,
          details: { scope: "uploads" }
        });
      }
      if (message.includes("idempotency_key_required")) {
        return respondError({ code: "idempotency_key_required", correlationId, status: 400 });
      }
      if (message.includes("title_required")) {
        return respondError({ code: "title_required", correlationId, status: 400 });
      }
      console.error("menu_title_dishes create failed", { correlationId, createError });
      return respondError({ code: "title_create_failed", correlationId, status: 400 });
    }

    const createdRow = Array.isArray(created) ? created[0] : created;
    const dishId = (createdRow?.dish_id as string | undefined) ?? null;
    const replay = Boolean(createdRow?.replay ?? false);
    if (!dishId) {
      return respondError({ code: "title_create_failed", correlationId, status: 400 });
    }

    const { data: item, error: fetchError } = await supabase
      .from("menu_title_dishes")
      .select("id, title, session_id, created_at, updated_at")
      .eq("id", dishId)
      .eq("owner_id", userId)
      .single();
    if (fetchError || !item) {
      console.error("menu_title_dishes fetch after insert failed", { correlationId, fetchError });
      return respondError({ code: "title_create_failed", correlationId, status: 400 });
    }

    const durationMs = Math.round(performance.now() - startedAt);
    logEvent({
      event: "menu_title_dish_created",
      correlationId,
      ownerId: userId,
      entityId: dishId,
      durationMs,
      status: replay ? "replay" : "created"
    });

    return respond({ item, replay, correlationId }, {}, correlationId);
  } catch (error) {
    console.error("menus-titles failure", { correlationId, error: String(error) });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
