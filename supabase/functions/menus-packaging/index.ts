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
    "authorization, x-client-info, apikey, content-type, x-correlation-id, x-internal-key"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const internalKey = Deno.env.get("MENU_PACKAGING_INTERNAL_KEY");

const packagingPayloadSchema = z.object({
  profileId: z.string().uuid().optional(),
  locale: z.string().min(2).optional(),
  storeId: z.string().uuid().nullable().optional(),
  source: z.string().min(1).max(64).optional(),
  updates: z
    .array(
      z.object({
        ingredientKey: z.string().min(1).max(200),
        packSize: z.number().positive(),
        packUnit: z.string().min(1).max(32),
        displayLabel: z.string().max(200).nullable().optional()
      })
    )
    .min(1)
    .max(250)
});

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

function authorizeInternalCall(req: Request) {
  if (!internalKey || !internalKey.trim().length) {
    return { ok: false as const, error: "packaging_service_disabled" };
  }
  const provided = req.headers.get("x-internal-key") ?? "";
  if (provided !== internalKey) {
    return { ok: false as const, error: "forbidden" };
  }
  return { ok: true as const };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  const auth = authorizeInternalCall(req);
  if (!auth.ok) {
    return respondError({
      code: auth.error,
      correlationId,
      status: auth.error === "forbidden" ? 403 : 503
    });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return respondError({ code: "supabase_not_configured", correlationId, status: 500 });
  }

  if (req.method !== "POST") {
    return respondError({ code: "method_not_allowed", correlationId, status: 405 });
  }

  try {
    const startedAt = performance.now();
    const raw = await req.json().catch(() => ({}));
    const parsed = packagingPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return respondError({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsed.error.flatten()
      });
    }
    const payload = parsed.data;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    let profileId = payload.profileId;
    if (!profileId) {
      const desiredLocale = payload.locale ?? "en_US";
      let profileQuery = supabase
        .from("menu_packaging_profiles")
        .select("id, created_at")
        .eq("locale", desiredLocale);
      if (payload.storeId) {
        profileQuery = profileQuery.eq("store_id", payload.storeId);
      } else {
        profileQuery = profileQuery.is("store_id", null);
      }
      const { data: existing, error: profileLookupError } = await profileQuery
        .order("created_at", { ascending: false })
        .limit(1);
      if (profileLookupError) {
        console.error("packaging profile lookup failed", { correlationId, profileLookupError });
      }
      if (existing?.length) {
        profileId = existing[0].id;
      } else {
        const { data: profile, error: profileError } = await supabase
          .from("menu_packaging_profiles")
          .insert({
            locale: desiredLocale,
            store_id: payload.storeId ?? null,
            label: payload.locale ? `Auto (${payload.locale})` : "Auto",
            metadata: { source: payload.source ?? "internal" }
          })
          .select("id")
          .single();
        if (profileError || !profile) {
          console.error("packaging profile insert failed", { correlationId, profileError });
          return respondError({ code: "profile_create_failed", correlationId, status: 400 });
        }
        profileId = profile.id;
      }
    }

    const records = payload.updates.map((item) => ({
      profile_id: profileId,
      ingredient_key: item.ingredientKey.toLowerCase().trim(),
      pack_size: item.packSize,
      pack_unit: item.packUnit,
      display_label: item.displayLabel ?? `${item.packSize} ${item.packUnit}`,
      last_used_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from("menu_packaging_units")
      .upsert(records, { onConflict: "profile_id,ingredient_key" })
      .select("id, ingredient_key, pack_size, pack_unit, display_label");
    if (error) {
      console.error("packaging units upsert failed", { correlationId, error });
      return respondError({ code: "packaging_update_failed", correlationId, status: 400 });
    }
    const durationMs = Math.round(performance.now() - startedAt);
    logEvent({
      event: "menu_packaging_upsert",
      correlationId,
      status: "ok",
      durationMs,
      metadata: {
        profileId,
        locale: payload.locale ?? "en_US",
        storeId: payload.storeId ?? null,
        updatedCount: data?.length ?? 0
      }
    });
    return respond({ profileId, units: data, correlationId }, {}, correlationId);
  } catch (error) {
    console.error("menus-packaging failure", { correlationId, error });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
