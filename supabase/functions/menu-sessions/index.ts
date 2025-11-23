import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { classifyProductName, normalizeProductName } from "../_shared/hybrid-classifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type SessionStatus = "pending" | "processing" | "needs_clarification" | "ready" | "error";
type IntentRoute = "template" | "llm" | "suggestion";

type CreateSessionPayload = {
  source?: { type?: "camera" | "gallery" | "upload"; uri?: string | null };
  titleHint?: string | null;
  isPremium?: boolean;
  metadata?: Record<string, unknown>;
  detections?: Array<{
    id?: string;
    rawText: string;
    normalizedText?: string | null;
    confidence?: number | null;
    boundingBox?: Record<string, unknown>;
  }>;
};

type UpdateSessionPayload = {
  status?: SessionStatus;
  cardIds?: string[];
  dishTitles?: string[];
  warnings?: string[];
  payload?: Record<string, unknown>;
  detections?: Array<{
    id?: string;
    rawText: string;
    normalizedText?: string | null;
    confidence?: number | null;
    boundingBox?: Record<string, unknown>;
  }>;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init,
  });
}

function parseSessionIdFromUrl(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((segment) => segment === "menu-sessions");
  if (idx === -1) {
    return null;
  }
  return segments[idx + 1] ?? null;
}

async function insertDetections(
  client: ReturnType<typeof createClient>,
  userId: string,
  sessionId: string,
  detections?: CreateSessionPayload["detections"]
) {
  if (!Array.isArray(detections) || detections.length === 0) {
    return [];
  }
  const records = detections.map((item) => ({
    id: item.id,
    session_id: sessionId,
    owner_id: userId,
    raw_text: item.rawText,
    normalized_text: item.normalizedText ?? normalizeProductName(item.rawText),
    confidence: item.confidence ?? null,
    bounding_box: item.boundingBox ?? {},
    classifier_tags: [],
    status: "pending"
  }));
  const { data, error } = await client.from("menu_session_items").insert(records).select("*");
  if (error) {
    console.error("menu_session_items insert failed", error);
    throw new Error("session_items_insert_failed");
  }
  return data ?? [];
}

async function classifyIntent(rows: any[]) {
  const results: Array<{ itemId: string; intent: IntentRoute; classifierTags: string[] }> = [];
  for (const row of rows) {
    const normalized = row.normalized_text ?? normalizeProductName(row.raw_text);
    const topMatch = classifyProductName(normalized, { limit: 1 })[0];
    let intent: IntentRoute = "llm";
    if (!topMatch) {
      intent = "llm";
    } else if (topMatch.category === "menu" || topMatch.category === "entree") {
      intent = "template";
    } else if (topMatch.category === "suggestion") {
      intent = "suggestion";
    }
    const tags = [`intent:${intent}`, `category:${topMatch?.category ?? "unknown"}`];
    results.push({ itemId: row.id, intent, classifierTags: tags });
  }
  return results;
}

async function getAuthedClient(req: Request) {
  if (!supabaseUrl || !anonKey) {
    throw new Error("supabase_not_configured");
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    throw new Error("auth_required");
  }
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new Error("auth_invalid");
  }
  return { client, userId: data.user.id, user: data.user };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let client;
  let userId;
  let user;
  try {
    const auth = await getAuthedClient(req);
    client = auth.client;
    userId = auth.userId;
    user = auth.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return jsonResponse({ error: message }, { status });
  }

  const url = new URL(req.url);
  const sessionId = parseSessionIdFromUrl(url);

  try {
    switch (req.method) {
      case "POST": {
        const payload = (await req.json().catch(() => ({}))) as CreateSessionPayload;
        const insertPayload = {
          owner_id: userId,
          status: "pending" as SessionStatus,
          source_asset_url: payload.source?.uri ?? null,
          payload: payload.metadata ?? {},
          dish_titles: [],
          card_ids: [],
          warnings: [],
          detected_document_type: payload.source?.type ?? null,
          is_premium: Boolean(payload.isPremium ?? user?.app_metadata?.is_menu_premium ?? false),
          intent_route: null as IntentRoute | null
        };

        const { data, error } = await client
          .from("menu_sessions")
          .insert(insertPayload)
          .select("*")
          .single();
        if (error) {
          console.error("menu_sessions insert failed", error);
          return jsonResponse({ error: "session_create_failed" }, { status: 400 });
        }

        let detections = [];
        if (payload.detections?.length) {
          detections = await insertDetections(client, userId, data.id, payload.detections);
        }
        const intentDecisions = await classifyIntent(detections.length ? detections : []);
        if (intentDecisions.length) {
          await client
            .from("menu_session_items")
            .upsert(
              intentDecisions.map((decision) => ({
                id: decision.itemId,
                classifier_tags: decision.classifierTags,
                status: "classified"
              }))
            );
          await client
            .from("menu_sessions")
            .update({ intent_route: intentDecisions[0]?.intent ?? null })
            .eq("id", data.id);
        }
        return jsonResponse({ session: data }, { status: 201 });
      }
      case "GET": {
        if (!sessionId) {
          return jsonResponse({ error: "session_id_required" }, { status: 400 });
        }
        const { data, error } = await client
          .from("menu_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();
        if (error) {
          return jsonResponse({ error: "session_not_found" }, { status: 404 });
        }
        return jsonResponse({ session: data });
      }
      case "PATCH": {
        if (!sessionId) {
          return jsonResponse({ error: "session_id_required" }, { status: 400 });
        }
        const body = (await req.json().catch(() => ({}))) as UpdateSessionPayload;
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.status) {
          updates.status = body.status;
        }
        if (body.cardIds) {
          updates.card_ids = body.cardIds;
        }
        if (body.dishTitles) {
          updates.dish_titles = body.dishTitles;
        }
        if (body.warnings) {
          updates.warnings = body.warnings;
        }
        if (body.payload) {
          updates.payload = body.payload;
        }
        if (body.detections?.length) {
          await insertDetections(client, userId, sessionId, body.detections);
          const latest = await client
            .from("menu_session_items")
            .select("*")
            .eq("session_id", sessionId);
          if (!latest.error && latest.data?.length) {
            const intentDecisions = await classifyIntent(latest.data);
            if (intentDecisions.length) {
              await client
                .from("menu_session_items")
                .upsert(
                  intentDecisions.map((decision) => ({
                    id: decision.itemId,
                    classifier_tags: decision.classifierTags,
                    status: "classified"
                  }))
                );
            }
          }
        }
        const { data, error } = await client
          .from("menu_sessions")
          .update(updates)
          .eq("id", sessionId)
          .select("*")
          .single();
        if (error) {
          return jsonResponse({ error: "session_update_failed" }, { status: 400 });
        }
        return jsonResponse({ session: data });
      }
      default:
        return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
    }
  } catch (error) {
    console.error("menu-sessions failure", error);
    return jsonResponse({ error: "internal_error" }, { status: 500 });
  }
});
