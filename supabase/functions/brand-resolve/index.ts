import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { levenshtein } from "../_shared/levenshtein.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseKey = serviceRoleKey ?? anonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or API key missing for brand-resolve function");
}

const supabase = createClient(supabaseUrl ?? "", supabaseKey ?? "", {
  auth: { persistSession: false },
});

export type ResolveRequest = {
  rawName: string;
  storeId?: string | null;
  brandId?: string | null;
};

type AliasRow = {
  alias: string;
  brand_id: string | null;
  confidence: number | null;
  source: string | null;
  store_id: string | null;
  brands: { id: string; name: string } | null;
};

export type ResolveResult =
  | {
      httpStatus: 200;
      response: {
        status: "matched";
        brand: { id: string; name: string } | null;
        brandId: string | null;
        confidence: number;
        source: string | null;
      };
    }
  | {
      httpStatus: 200;
      response: {
        status: "alias_created";
        brandId: string | null;
        brand: { id: string; name: string } | null;
        confidence: number;
      };
    }
  | {
      httpStatus: 200;
      response: {
        status: "fallback";
        reason: "missing_alias" | "low_confidence";
        confidence: number;
      };
    }
  | {
      httpStatus: 409;
      response: {
        status: "fallback";
        reason: "conflict";
        matches: Array<{
          brandId: string | null;
          brandName: string | null;
          confidence: number | null;
          source: string | null;
        }>;
      };
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

function tokenSetScore(a: string, b: string) {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (!setA.size || !setB.size) {
    return 0;
  }
  const intersection = Array.from(setA).filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    ...init,
  });
}

function computeConfidence(candidate: AliasRow, target: string) {
  const alias = candidate.alias ?? target;
  const base = candidate.confidence ?? 0.4;
  const tokenScore = tokenSetScore(alias, target);
  const levScore =
    1 - levenshtein(alias, target) / Math.max(alias.length, target.length, 1);
  const weighted = Math.max(base, (tokenScore + levScore) / 2);
  return Number(weighted.toFixed(3));
}

async function createAlias(
  client: SupabaseClient,
  payload: ResolveRequest,
  normalised: string,
) {
  if (!payload.brandId) {
    return null;
  }
  const { data, error } = await client
    .from("brand_aliases")
    .insert({
      brand_id: payload.brandId,
      alias: normalised,
      store_id: payload.storeId ?? null,
      confidence: 0.45,
      source: "auto",
    })
    .select("brand_id, confidence, source, store_id, alias, brands ( id, name )")
    .single<AliasRow>();

  if (error) {
    console.error("brand-resolve: failed creating alias", error);
    throw new Error("alias_creation_failed");
  }
  return data;
}

export async function resolveBrand(
  client: SupabaseClient,
  payload: ResolveRequest,
): Promise<ResolveResult> {
  if (!payload?.rawName || typeof payload.rawName !== "string") {
    throw new Error("rawName_required");
  }

  const normalised = normalise(payload.rawName);
  const storeId = payload.storeId ?? null;
  const selectColumns =
    "alias, brand_id, confidence, source, store_id, brands ( id, name )";

  const { data: storeMatches, error: storeError } = await client
    .from("brand_aliases")
    .select(selectColumns)
    .eq("store_id", storeId)
    .ilike("alias", `%${normalised}%`)
    .limit(10);

  if (storeError) {
    throw new Error(`alias_lookup_failed:${storeError.message}`);
  }

  const { data: genericMatches, error: genericError } = await client
    .from("brand_aliases")
    .select(selectColumns)
    .is("store_id", null)
    .ilike("alias", `%${normalised}%`)
    .limit(10);

  if (genericError) {
    throw new Error(`alias_lookup_failed:${genericError.message}`);
  }

  const candidates: AliasRow[] = [...(storeMatches ?? []), ...(genericMatches ?? [])]
    .map((candidate) => ({
      ...candidate,
      confidence: computeConfidence(candidate as AliasRow, normalised),
    }))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

  if (!candidates.length) {
    if (payload.brandId) {
      const created = await createAlias(client, payload, normalised);
      if (created) {
        return {
          httpStatus: 200,
          response: {
            status: "alias_created",
            brand: created.brands ? { id: created.brands.id, name: created.brands.name } : null,
            brandId: created.brand_id,
            confidence: created.confidence ?? 0.45,
          },
        };
      }
    }
    return {
      httpStatus: 200,
      response: {
        status: "fallback",
        reason: "missing_alias",
        confidence: 0,
      },
    };
  }

  const uniqueBrands = Array.from(new Set(candidates.map((entry) => entry.brand_id)));
  if (uniqueBrands.length > 1 && (candidates[0]?.confidence ?? 0) >= 0.6) {
    return {
      httpStatus: 409,
      response: {
        status: "fallback",
        reason: "conflict",
        matches: candidates.slice(0, 5).map((entry) => ({
          brandId: entry.brand_id,
          brandName: entry.brands?.name ?? null,
          confidence: entry.confidence ?? null,
          source: entry.source ?? null,
        })),
      },
    };
  }

  const match = candidates[0];
  const confidence = match?.confidence ?? 0.5;
  if (confidence < 0.55) {
    return {
      httpStatus: 200,
      response: {
        status: "fallback",
        reason: "low_confidence",
        confidence,
      },
    };
  }

  return {
    httpStatus: 200,
    response: {
      status: "matched",
      brand: match?.brands ? { id: match.brands.id, name: match.brands.name } : null,
      brandId: match?.brand_id ?? null,
      confidence,
      source: match?.source ?? "alias",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "supabase_credentials_missing" }, { status: 500 });
  }

  try {
    const payload = (await req.json()) as ResolveRequest;
    const result = await resolveBrand(supabase, payload);
    return jsonResponse(result.response, { status: result.httpStatus });
  } catch (error) {
    console.error('brand-resolve: unexpected error', error);
    return jsonResponse({ error: "invalid_request" }, { status: 400 });
  }
});
