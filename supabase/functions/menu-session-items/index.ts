import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { classifyProductName, confidenceBand, normalizeProductName } from "../_shared/hybrid-classifier.ts";
import {
  errorResponse,
  getCorrelationId,
  jsonResponse,
  logEvent
} from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
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
  const sessionIdFromPath = parseSessionId(url);

  try {
    if (req.method === "GET") {
      if (!sessionIdFromPath) {
        return respondError({ code: "session_id_required", correlationId, status: 400 });
      }
      const { data, error } = await supabase
        .from("menu_session_items")
        .select("*")
        .eq("session_id", sessionIdFromPath)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("menu_session_items list failed", error);
        return respondError({ code: "session_items_failed", correlationId, status: 400 });
      }
      return respond({ items: data }, {}, correlationId);
    }

    if (req.method === "POST") {
      const payload = (await req.json().catch(() => ({}))) as SessionItemPayload;
      const sessionId = payload.sessionId ?? sessionIdFromPath;
      if (!sessionId) {
        return respondError({ code: "session_id_required", correlationId, status: 400 });
      }
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        return respondError({ code: "items_required", correlationId, status: 400 });
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
        return respondError({ code: "session_items_insert_failed", correlationId, status: 400 });
      }
      logEvent({
        event: "menu_session_items_insert",
        correlationId,
        ownerId: userId,
        sessionId,
        status: "created",
        metadata: { count: data?.length ?? 0 }
      });
      return respond({ items: data, correlationId }, { status: 201 }, correlationId);
    }

    if (req.method === "PATCH") {
      if (!sessionIdFromPath) {
        return respondError({ code: "session_id_required", correlationId, status: 400 });
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
        return respondError({ code: "item_updates_required", correlationId, status: 400 });
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
        return respondError({ code: "session_items_update_failed", correlationId, status: 400 });
      }
      logEvent({
        event: "menu_session_items_update",
        correlationId,
        ownerId: userId,
        sessionId: sessionIdFromPath,
        entityId: data.id,
        status: "updated"
      });
      return respond({ item: data, correlationId }, {}, correlationId);
    }

    return respondError({ code: "method_not_allowed", correlationId, status: 405 });
  } catch (error) {
    console.error("menu-session-items failure", error);
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
