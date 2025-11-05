import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !anonKey) {
  console.error("Supabase environment variables are missing");
}

const supabase = createClient(supabaseUrl ?? "", serviceRoleKey ?? anonKey ?? "", {
  auth: { persistSession: false },
});

type ResolveRequest = {
  rawName: string;
  storeId?: string | null;
  productId?: string | null;
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    ...init,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "supabase_credentials_missing" }, { status: 500 });
  }

  try {
    const payload = (await req.json()) as ResolveRequest;
    if (!payload?.rawName || typeof payload.rawName !== "string") {
      return jsonResponse({ error: "rawName_required" }, { status: 400 });
    }

    const normalised = normalise(payload.rawName);
    const storeId = payload.storeId ?? null;

    const selectColumns = "brand_id, confidence, source, store_id, brands ( id, name )";

    const { data: storeMatches, error: storeError } = await supabase
      .from("brand_aliases")
      .select(selectColumns)
      .eq("store_id", storeId)
      .ilike("alias", normalised)
      .order("confidence", { ascending: false })
      .limit(5);

    if (storeError) {
      console.error("brand-resolve: store alias lookup failed", storeError);
      return jsonResponse({ error: "internal_error" }, { status: 500 });
    }

    const { data: genericMatches, error: genericError } = await supabase
      .from("brand_aliases")
      .select(selectColumns)
      .is("store_id", null)
      .ilike("alias", normalised)
      .order("confidence", { ascending: false })
      .limit(5);

    if (genericError) {
      console.error("brand-resolve: generic alias lookup failed", genericError);
      return jsonResponse({ error: "internal_error" }, { status: 500 });
    }

    const candidates = [...(storeMatches ?? []), ...(genericMatches ?? [])];

    if (candidates.length === 0) {
      return jsonResponse({
        status: "fallback",
        reason: "missing_alias",
        confidence: 0,
      });
    }

    const uniqueBrands = Array.from(new Set(candidates.map((entry) => entry.brand_id)));
    if (uniqueBrands.length > 1 && (candidates[0]?.confidence ?? 0) >= 0.5) {
      return jsonResponse({
        status: "fallback",
        reason: "conflict",
        matches: candidates.map((entry) => ({
          brandId: entry.brand_id,
          brandName: entry.brands?.name ?? null,
          confidence: entry.confidence ?? null,
          source: entry.source ?? null,
        })),
      }, { status: 409 });
    }

    const match = candidates[0];
    const confidence = match?.confidence ?? 0.5;

    return jsonResponse({
      status: "matched",
      brand: match?.brands ? { id: match.brands.id, name: match.brands.name } : null,
      brandId: match?.brand_id ?? null,
      confidence,
      source: match?.source ?? "alias",
    });
  } catch (error) {
    console.error('brand-resolve: unexpected error', error);
    return jsonResponse({ error: "invalid_request" }, { status: 400 });
  }
});
