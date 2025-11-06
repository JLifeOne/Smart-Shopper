import { assertEquals, assert } from "https://deno.land/std@0.207.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { resolveBrand, type ResolveRequest, type ResolveResult } from "./index.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL or service role key missing for tests");
}

const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function createStore(name: string) {
  const { data, error } = await client
    .from("stores")
    .insert({ name, brand: name, address: null, geo: null })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("failed to create store");
  }
  return data.id as string;
}

async function cleanup(ids: { brandIds?: string[]; storeIds?: string[] }) {
  if (ids.brandIds?.length) {
    await client.from("brands").delete().in("id", ids.brandIds);
  }
  if (ids.storeIds?.length) {
    await client.from("stores").delete().in("id", ids.storeIds);
  }
}

function assertStatus<T extends ResolveResult["response"]["status"]>(
  result: ResolveResult,
  expected: T,
) {
  assertEquals(result.response.status, expected);
  return result.response as Extract<ResolveResult["response"], { status: T }>;
}

Deno.test("matches store-specific alias with high confidence", async () => {
  const storeId = await createStore("Backfill Store");
  const { data: brand, error: brandError } = await client
    .from("brands")
    .insert({ name: "Grace", normalized_name: "grace" })
    .select("id")
    .single();
  if (brandError || !brand) {
    await cleanup({ storeIds: [storeId] });
    throw brandError ?? new Error("failed to create brand");
  }
  const { error: aliasError } = await client
    .from("brand_aliases")
    .insert({
      brand_id: brand.id,
      alias: "grace baked beans",
      store_id: storeId,
      confidence: 0.7,
      source: "seed",
    });
  if (aliasError) {
    await cleanup({ brandIds: [brand.id], storeIds: [storeId] });
    throw aliasError;
  }

  const request: ResolveRequest = {
    rawName: "Grace Baked Beans 300g",
    storeId,
  };
  const result = await resolveBrand(client, request);
  const response = assertStatus(result, "matched");

  await cleanup({ brandIds: [brand.id], storeIds: [storeId] });

  assertEquals(result.httpStatus, 200);
  assert(response.brandId === brand.id);
  assert(response.confidence >= 0.6);
});

Deno.test("returns low confidence fallback when similarity too weak", async () => {
  const storeId = await createStore("Low Confidence Store");
  const { data: brand } = await client
    .from("brands")
    .insert({ name: "Generic", normalized_name: "generic" })
    .select("id")
    .single();
  await client.from("brand_aliases").insert({
    brand_id: brand?.id ?? null,
    alias: "random words",
    store_id: storeId,
    confidence: 0.4,
    source: "seed",
  });

  const result = await resolveBrand(client, {
    rawName: "Completely Different Name",
    storeId,
  });

  const response = assertStatus(result, "fallback");
  assertEquals(response.reason, "low_confidence");

  await cleanup({ brandIds: brand ? [brand.id] : [], storeIds: [storeId] });
});

Deno.test("returns conflict when multiple brands share alias", async () => {
  const storeId = await createStore("Conflict Store");
  const { data: brands } = await client
    .from("brands")
    .insert([
      { name: "Brand A", normalized_name: "brand a" },
      { name: "Brand B", normalized_name: "brand b" },
    ])
    .select("id");

  await client.from("brand_aliases").insert([
    {
      brand_id: brands?.[0]?.id ?? null,
      alias: "shared phrase",
      store_id: storeId,
      confidence: 0.65,
      source: "seed",
    },
    {
      brand_id: brands?.[1]?.id ?? null,
      alias: "shared phrase",
      store_id: storeId,
      confidence: 0.6,
      source: "seed",
    },
  ]);

  const result = await resolveBrand(client, {
    rawName: "Shared Phrase",
    storeId,
  });

  assertEquals(result.httpStatus, 409);
  const response = assertStatus(result, "fallback");
  assertEquals(response.reason, "conflict");

  await cleanup({
    brandIds: brands?.map((row) => row.id) ?? [],
    storeIds: [storeId],
  });
});

Deno.test("creates alias when brand id provided", async () => {
  const storeId = await createStore("Aliasless Store");
  const { data: brand, error } = await client
    .from("brands")
    .insert({ name: "Aliasless", normalized_name: "aliasless" })
    .select("id")
    .single();
  if (error || !brand) {
    await cleanup({ storeIds: [storeId] });
    throw error ?? new Error("failed to create brand");
  }

  const result = await resolveBrand(client, {
    rawName: "Aliasless Raw Name",
    storeId,
    brandId: brand.id,
  });
  const response = assertStatus(result, "alias_created");
  assertEquals(result.httpStatus, 200);
  assert(response.brandId === brand.id);

  await cleanup({ brandIds: [brand.id], storeIds: [storeId] });
});
