import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import {
  classifyProductName,
  confidenceBand,
} from "../_shared/hybrid-classifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

const supabase = createClient(supabaseUrl ?? "", serviceKey ?? "", { auth: { persistSession: false } });

type Item = { rawName: string; storeId?: string | null; brandId?: string | null };
type Out = Item & {
  status: "matched" | "alias_created" | "fallback";
  brandId?: string | null;
  brandName?: string | null;
  confidence?: number;
  reason?: string;
  category?: string | null;
  categoryConfidence?: number | null;
  categoryBand?: string | null;
  categorySource?: string | null;
  categoryCanonical?: string | null;
};

function normalise(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

async function resolveOne(client: SupabaseClient, it: Item): Promise<Out> {
  const norm = normalise(it.rawName);
  const classifier = classifyProductName(it.rawName, { limit: 1 })[0] ?? null;
  const tokens = norm.split(" ").filter((t) => t.length >= 3 && !/^[0-9]+$/.test(t)).slice(0, 3);
  const orFilter = tokens.length ? tokens.map((t) => `alias.ilike.%${t}%`).join(",") : `alias.ilike.%${norm.split(" ").slice(0,2).join(" ")}%`;
  const selectCols = "alias, brand_id, confidence, source, store_id, brands ( id, name )";
  const classifyFields = classifier
    ? {
        category: classifier.category,
        categoryConfidence: Number(classifier.confidence.toFixed(3)),
        categoryBand: confidenceBand(classifier.confidence),
        categorySource: classifier.source,
        categoryCanonical: classifier.canonicalName,
      }
    : {
        category: null,
        categoryConfidence: null,
        categoryBand: null,
        categorySource: null,
        categoryCanonical: null,
      };

  // store-specific first
  let candidates: any[] = [];
  if (it.storeId) {
    let q = client.from('brand_aliases').select(selectCols).eq('store_id', it.storeId).limit(15) as any;
    q = tokens.length ? q.or(orFilter) : q.ilike('alias', `%${norm}%`);
    const { data, error } = await q;
    if (error) throw new Error(`lookup_store:${error.message}`);
    candidates.push(...(data ?? []));
  }
  // generic
  let qg = client.from('brand_aliases').select(selectCols).is('store_id', null).limit(15) as any;
  qg = tokens.length ? qg.or(orFilter) : qg.ilike('alias', `%${norm}%`);
  const { data: generics, error: gerr } = await qg;
  if (gerr) throw new Error(`lookup_generic:${gerr.message}`);
  candidates.push(...(generics ?? []));

  if (!candidates.length) {
    // opportunistic alias create if brandId is provided
    if (it.brandId) {
      const { data, error } = await client.from('brand_aliases').insert({ brand_id: it.brandId, alias: norm, store_id: it.storeId ?? null, confidence: 0.45, source: 'auto' }).select('brand_id, brands ( id, name ), confidence').single();
      if (!error && data) {
        return {
          ...it,
          ...classifyFields,
          status: 'alias_created',
          brandId: data.brand_id,
          brandName: data.brands?.name ?? null,
          confidence: data.confidence ?? 0.45
        };
      }
    }
    return { ...it, ...classifyFields, status: 'fallback', reason: 'missing_alias' };
  }

  // pick highest confidence; basic scoring already in table
  candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const best = candidates[0];
  const conf = best?.confidence ?? 0.5;
  if (conf < 0.55) {
    return {
      ...it,
      ...classifyFields,
      status: 'fallback',
      reason: 'low_confidence',
      confidence: conf
    };
  }
  return {
    ...it,
    ...classifyFields,
    status: 'matched',
    brandId: best.brand_id ?? null,
    brandName: best.brands?.name ?? null,
    confidence: conf
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!supabaseUrl || !serviceKey) return new Response(JSON.stringify({ error: 'supabase_credentials_missing' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } });
  try {
    const body = await req.json();
    const items: Item[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return new Response(JSON.stringify({ error: 'no_items' }), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } });
    const out: Out[] = [];
    for (const it of items) {
      try { out.push(await resolveOne(supabase, it)); }
      catch (e) { out.push({ ...it, status: 'fallback', reason: 'error' }); }
    }
    return new Response(JSON.stringify({ items: out }), { status: 200, headers: { 'content-type': 'application/json', ...corsHeaders } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders } });
  }
});
