import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type PackagingPayload = {
  profileId?: string;
  locale?: string;
  storeId?: string | null;
  updates: Array<{
    ingredientKey: string;
    packSize: number;
    packUnit: string;
    displayLabel?: string | null;
  }>;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init
  });
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

  let supabase;
  try {
    ({ client: supabase } = await getAuthedClient(req));
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return jsonResponse({ error: message }, { status });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    const startedAt = performance.now();
    const payload = (await req.json().catch(() => ({}))) as PackagingPayload;
    if (!Array.isArray(payload.updates) || payload.updates.length === 0) {
      return jsonResponse({ error: "updates_required" }, { status: 400 });
    }

    let profileId = payload.profileId;
    if (!profileId) {
      const { data: profile, error: profileError } = await supabase
        .from("menu_packaging_profiles")
        .insert({
          locale: payload.locale ?? "en_US",
          store_id: payload.storeId ?? null,
          label: payload.locale ? `Auto (${payload.locale})` : "Auto",
          metadata: { source: "stub" }
        })
        .select("id")
        .single();
      if (profileError || !profile) {
        console.error("packaging profile insert failed", profileError);
        return jsonResponse({ error: "profile_create_failed" }, { status: 400 });
      }
      profileId = profile.id;
    }

    const records = payload.updates.map((item) => ({
      profile_id: profileId,
      ingredient_key: item.ingredientKey.toLowerCase(),
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
      console.error("packaging units upsert failed", error);
      return jsonResponse({ error: "packaging_update_failed" }, { status: 400 });
    }
    const durationMs = Math.round(performance.now() - startedAt);
    console.log(
      JSON.stringify({
        event: "menu_packaging_upsert",
        profileId,
        locale: payload.locale ?? "en_US",
        storeId: payload.storeId ?? null,
        updatedCount: data?.length ?? 0,
        durationMs
      })
    );
    return jsonResponse({ profileId, units: data });
  } catch (error) {
    console.error("menus-packaging failure", error);
    return jsonResponse({ error: "internal_error" }, { status: 500 });
  }
});
