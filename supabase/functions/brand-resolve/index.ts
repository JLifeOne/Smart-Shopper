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
  // PostgREST relationship embedding can be returned as an object (many-to-one) or an array
  // depending on the relationship inference. Handle both to keep Deno typecheck stable.
  brands: { id: string; name: string } | Array<{ id: string; name: string }> | null;
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

function firstBrand(value: AliasRow["brands"]) {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.length ? value[0] : null;
  }
  return value;
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

  // Build a permissive OR filter so short aliases can match longer raw names
  const tokens = normalised.split(" ").filter((t) => t.length >= 3 && !/^[0-9]+$/.test(t)).slice(0, 3);
  const orFilter = tokens.length
    ? tokens.map((t) => `alias.ilike.%${t}%`).join(",")
    : `alias.ilike.%${normalised.split(" ").slice(0, 2).join(" ")}%`;

  let storeMatches: AliasRow[] = [];
  if (storeId) {
    let query = client
      .from("brand_aliases")
      .select(selectColumns)
      .eq("store_id", storeId)
      .limit(15);
    // use OR filter across important tokens so shorter aliases match
    if (tokens.length) {
      query = query.or(orFilter);
    } else {
      query = query.ilike("alias", `%${normalised}%`);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`alias_lookup_failed:${error.message}`);
    }
    storeMatches = (data ?? []) as AliasRow[];
  }

  let genericQuery = client
    .from("brand_aliases")
    .select(selectColumns)
    .is("store_id", null)
    .limit(15);
  if (tokens.length) {
    genericQuery = genericQuery.or(orFilter);
  } else {
    genericQuery = genericQuery.ilike("alias", `%${normalised}%`);
  }
  const { data: genericMatches, error: genericError } = await genericQuery;

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
        const brand = firstBrand(created.brands);
        return {
          httpStatus: 200,
          response: {
            status: "alias_created",
            brand: brand ? { id: brand.id, name: brand.name } : null,
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
          // When embedded as an array, take the first match for display.
          brandId: entry.brand_id,
          brandName: firstBrand(entry.brands)?.name ?? null,
          confidence: entry.confidence ?? null,
          source: entry.source ?? null,
        })),
      },
    };
  }

  const match = candidates[0];
  const brand = firstBrand(match?.brands ?? null);
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
      brand: brand ? { id: brand.id, name: brand.name } : null,
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
    const requireAuth = (Deno.env.get("REQUIRE_AUTHENTICATED") ?? "false").toLowerCase() === "true";
    if (requireAuth) {
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      const parts = token.split(".");
      if (parts.length < 2) {
        return jsonResponse({ error: "auth_required" }, { status: 401 });
      }
      try {
        const json = new TextDecoder().decode(Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0)));
        const claims = JSON.parse(json);
        const role = String(claims?.role ?? "");
        if (role !== "authenticated" && role !== "service_role") {
          return jsonResponse({ error: "auth_required" }, { status: 401 });
        }
      } catch {
        return jsonResponse({ error: "auth_required" }, { status: 401 });
      }
    }
    const payload = (await req.json()) as ResolveRequest;
    const result = await resolveBrand(supabase, payload);
    return jsonResponse(result.response, { status: result.httpStatus });
  } catch (error) {
    console.error('brand-resolve: unexpected error', error);
    const msg = (error as Error)?.message ?? 'unknown';
    return jsonResponse({ error: "invalid_request", code: msg }, { status: 400 });
  }
});
