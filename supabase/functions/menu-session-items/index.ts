import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { classifyProductName, confidenceBand, normalizeProductName } from "../_shared/hybrid-classifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type SessionItemPayload = {
  sessionId: string;
  items: Array<{
    id?: string;
    rawText: string;
    normalizedText?: string | null;
    confidence?: number | null;
    boundingBox?: Record<string, unknown>;
    localeHint?: string | null;
    classifierTags?: string[];
    status?: string;
  }>;
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

function parseSessionId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((segment) => segment === "menu-session-items");
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
  const sessionIdFromPath = parseSessionId(url);

  try {
    if (req.method === "GET") {
      if (!sessionIdFromPath) {
        return jsonResponse({ error: "session_id_required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("menu_session_items")
        .select("*")
        .eq("session_id", sessionIdFromPath)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("menu_session_items list failed", error);
        return jsonResponse({ error: "session_items_failed" }, { status: 400 });
      }
      return jsonResponse({ items: data });
    }

    if (req.method === "POST") {
      const payload = (await req.json().catch(() => ({}))) as SessionItemPayload;
      const sessionId = payload.sessionId ?? sessionIdFromPath;
      if (!sessionId) {
        return jsonResponse({ error: "session_id_required" }, { status: 400 });
      }
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        return jsonResponse({ error: "items_required" }, { status: 400 });
      }
      const insertRecords = payload.items.map((item) => {
        const normalized = item.normalizedText ?? normalizeProductName(item.rawText);
        const classification = classifyProductName(normalized, { limit: 1 })?.[0];
        const tags = item.classifierTags ?? [];
        if (classification) {
          const band = confidenceBand(classification.confidence);
          const intent = band === "auto" ? "template" : band === "suggestion" ? "suggestion" : "llm";
          tags.push(`category:${classification.category}`);
          tags.push(`intent:${intent}`);
        }
        return {
          id: item.id,
          session_id: sessionId,
          owner_id: userId,
          raw_text: item.rawText,
          normalized_text: normalized,
          confidence: item.confidence ?? classification?.confidence ?? null,
          bounding_box: item.boundingBox ?? {},
          locale_hint: item.localeHint ?? null,
          classifier_tags: Array.from(new Set(tags)),
          status: item.status ?? (classification ? "classified" : "pending"),
        };
      });
      const { data, error } = await supabase.from("menu_session_items").insert(insertRecords).select("*");
      if (error) {
        console.error("menu_session_items insert failed", error);
        return jsonResponse({ error: "session_items_insert_failed" }, { status: 400 });
      }
    console.log(
      JSON.stringify({
        event: "menu_session_items_insert",
        sessionId,
        ownerId: userId,
        count: data?.length ?? 0
      })
    );
    return jsonResponse({ items: data }, { status: 201 });
    }

    if (req.method === "PATCH") {
      if (!sessionIdFromPath) {
        return jsonResponse({ error: "session_id_required" }, { status: 400 });
      }
      const body = (await req.json().catch(() => ({}))) as {
        itemId: string;
        updates: Partial<{
          normalizedText: string | null;
          confidence: number | null;
          classifierTags: string[];
          status: string;
        }>;
      };
      if (!body.itemId || !body.updates) {
        return jsonResponse({ error: "item_updates_required" }, { status: 400 });
      }
      const updates: Record<string, unknown> = {};
      if (body.updates.normalizedText !== undefined) updates.normalized_text = body.updates.normalizedText;
      if (body.updates.confidence !== undefined) updates.confidence = body.updates.confidence;
      if (body.updates.classifierTags !== undefined) updates.classifier_tags = body.updates.classifierTags;
      if (body.updates.status !== undefined) updates.status = body.updates.status;
      if (body.updates.normalizedText !== undefined && !body.updates.classifierTags) {
        const classification = classifyProductName(body.updates.normalizedText ?? "", { limit: 1 })?.[0];
        if (classification) {
          const band = confidenceBand(classification.confidence);
          const intent = band === "auto" ? "template" : band === "suggestion" ? "suggestion" : "llm";
          updates.classifier_tags = [
            `category:${classification.category}`,
            `intent:${intent}`
          ];
          updates.confidence = classification.confidence;
        }
      }

      const { data, error } = await supabase
        .from("menu_session_items")
        .update(updates)
        .eq("id", body.itemId)
        .eq("session_id", sessionIdFromPath)
        .eq("owner_id", userId)
        .select("*")
        .single();
      if (error) {
        console.error("menu_session_items update failed", error);
        return jsonResponse({ error: "session_items_update_failed" }, { status: 400 });
      }
      return jsonResponse({ item: data });
    }

    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  } catch (error) {
    console.error("menu-session-items failure", error);
    return jsonResponse({ error: "internal_error" }, { status: 500 });
  }
});
