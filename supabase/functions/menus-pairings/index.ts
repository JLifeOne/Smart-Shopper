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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type PairingPayload = {
  title?: string;
  description?: string | null;
  dishIds?: string[];
  locale?: string | null;
};

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
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) throw new Error("auth_invalid");
  return { client, userId: data.user.id };
}

function parsePairingId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((segment) => segment === "menus-pairings");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  let supabase;
  let userId;
  try {
    const auth = await getAuthedClient(req);
    supabase = auth.client;
    userId = auth.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return respondError({ code: message, correlationId, status });
  }

  const url = new URL(req.url);
  const pairingId = parsePairingId(url);

  try {
    switch (req.method) {
      case "GET": {
        const locale = url.searchParams.get("locale");
        let query = supabase
          .from("menu_combos")
          .select("*")
          .or(`owner_id.eq.${userId},is_default.eq.true`)
          .order("created_at", { ascending: false })
          .limit(20);
        if (locale) {
          query = query.eq("locale", locale);
        }
        const { data, error } = await query;
        if (error) {
          return respondError({ code: "pairings_fetch_failed", correlationId, status: 400 });
        }
        return respond({ items: data, correlationId }, {}, correlationId);
      }
      case "POST": {
        const payload = (await req.json().catch(() => ({}))) as PairingPayload;
        const title = payload.title?.trim();
        const dishIds = Array.isArray(payload.dishIds) ? payload.dishIds.filter(Boolean) : [];
        if (!title || !dishIds.length) {
          return respondError({ code: "title_and_dishes_required", correlationId, status: 400 });
        }
        const { data, error } = await supabase
          .from("menu_combos")
          .insert({
            owner_id: userId,
            title,
            description: payload.description ?? null,
            dish_ids: dishIds,
            locale: payload.locale ?? null,
            is_default: false
          })
          .select("*")
          .single();
        if (error) {
          return respondError({ code: "pairing_create_failed", correlationId, status: 400 });
        }
        logEvent({
          event: "menu_pairing_created",
          correlationId,
          ownerId: userId,
          entityId: data.id,
          status: "created"
        });
        return respond({ pairing: data, correlationId }, { status: 201 }, correlationId);
      }
      case "DELETE": {
        if (!pairingId) {
          return respondError({ code: "pairing_id_required", correlationId, status: 400 });
        }
        const { error } = await supabase
          .from("menu_combos")
          .delete()
          .eq("id", pairingId)
          .eq("owner_id", userId);
        if (error) {
          return respondError({ code: "pairing_delete_failed", correlationId, status: 400 });
        }
        logEvent({
          event: "menu_pairing_deleted",
          correlationId,
          ownerId: userId,
          entityId: pairingId,
          status: "deleted"
        });
        return respond({ success: true, correlationId }, {}, correlationId);
      }
      default:
        return respondError({ code: "method_not_allowed", correlationId, status: 405 });
    }
  } catch (error) {
    console.error("menus-pairings failure", error);
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
