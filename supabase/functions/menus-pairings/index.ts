import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type PairingPayload = {
  title?: string;
  description?: string | null;
  dishIds?: string[];
  locale?: string | null;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init,
  });
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

  let supabase;
  let userId;
  try {
    const auth = await getAuthedClient(req);
    supabase = auth.client;
    userId = auth.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return jsonResponse({ error: message }, { status });
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
          return jsonResponse({ error: "pairings_fetch_failed" }, { status: 400 });
        }
        return jsonResponse({ items: data });
      }
      case "POST": {
        const payload = (await req.json().catch(() => ({}))) as PairingPayload;
        const title = payload.title?.trim();
        const dishIds = Array.isArray(payload.dishIds) ? payload.dishIds.filter(Boolean) : [];
        if (!title || !dishIds.length) {
          return jsonResponse({ error: "title_and_dishes_required" }, { status: 400 });
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
          return jsonResponse({ error: "pairing_create_failed" }, { status: 400 });
        }
        return jsonResponse({ pairing: data }, { status: 201 });
      }
      case "DELETE": {
        if (!pairingId) {
          return jsonResponse({ error: "pairing_id_required" }, { status: 400 });
        }
        const { error } = await supabase
          .from("menu_combos")
          .delete()
          .eq("id", pairingId)
          .eq("owner_id", userId);
        if (error) {
          return jsonResponse({ error: "pairing_delete_failed" }, { status: 400 });
        }
        return jsonResponse({ success: true });
      }
      default:
        return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
    }
  } catch (error) {
    console.error("menus-pairings failure", error);
    return jsonResponse({ error: "internal_error" }, { status: 500 });
  }
});
