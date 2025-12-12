import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Idempotency-Key, x-correlation-id"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type ConvertPayload = {
  dishIds?: string[];
  peopleCountOverride?: number;
  persistList?: boolean;
  listName?: string | null;
  storeId?: string | null;
};

type Ingredient = {
  name?: string;
  quantity?: number;
  unit?: string | null;
  notes?: string | null;
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init
  });
}

function getCorrelationId(req: Request) {
  return (
    req.headers.get("x-correlation-id") ??
    req.headers.get("Idempotency-Key") ??
    crypto.randomUUID()
  );
}

function getIdempotencyKey(req: Request) {
  return req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
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
  return { client, userId: data.user.id, user: data.user };
}

function aggregateIngredients(recipes: any[], peopleOverride?: number) {
  const map = new Map<string, { name: string; unit?: string | null; quantity: number; notes?: string | null }>();
  for (const recipe of recipes) {
    const servings = (recipe.servings ?? {}) as Record<string, unknown>;
    const basePeople = Number(servings?.people_count ?? 1) || 1;
    const targetPeople = peopleOverride && peopleOverride > 0 ? peopleOverride : basePeople;
    const scaleFactor = targetPeople / basePeople;
    const ingList: Ingredient[] = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    ingList.forEach((ing) => {
      const name = ing.name?.trim();
      if (!name) return;
      const unit = ing.unit ?? null;
      const key = `${name.toLowerCase()}|${unit ?? ""}`;
      const qty = Number(ing.quantity ?? 1) * scaleFactor;
      const existing = map.get(key) ?? { name, unit, quantity: 0, notes: ing.notes ?? null };
      existing.quantity += qty;
      if (!existing.notes && ing.notes) {
        existing.notes = ing.notes;
      }
      map.set(key, existing);
    });
  }
  return Array.from(map.values()).map((line) => ({
    name: line.name,
    unit: line.unit,
    quantity: Number(line.quantity.toFixed(2)),
    notes: line.notes ?? null,
    packaging: line.unit ? `Approx. ${line.quantity} ${line.unit}` : `Approx. ${line.quantity}`
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  let supabase;
  let userId;
  let user;
  try {
    const auth = await getAuthedClient(req);
    supabase = auth.client;
    userId = auth.userId;
    user = auth.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return jsonResponse({ error: message, correlationId }, { status });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed", correlationId }, { status: 405 });
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as ConvertPayload;
    const dishIds = Array.isArray(payload.dishIds) ? payload.dishIds.filter(Boolean) : [];
    if (!dishIds.length) {
      return jsonResponse({ error: "dish_ids_required", correlationId }, { status: 400 });
    }

    const { data: recipes, error } = await supabase
      .from("menu_recipes")
      .select("id, title, ingredients, servings, scale_factor, dietary_tags, allergen_tags")
      .in("id", dishIds)
      .eq("owner_id", userId);
    if (error) {
      console.error("menu_recipes fetch failed", error);
      return jsonResponse({ error: "recipes_fetch_failed", correlationId }, { status: 400 });
    }
    if ((recipes ?? []).length !== dishIds.length) {
      return jsonResponse({ error: "missing_recipes", correlationId }, { status: 404 });
    }

    const { data: preferences } = await supabase
      .from("menu_user_preferences")
      .select("dietary_tags, allergen_flags")
      .eq("owner_id", userId)
      .single();

    const requiredDietary = Array.isArray(preferences?.dietary_tags) ? preferences?.dietary_tags : [];
    const allergenFlags = Array.isArray(preferences?.allergen_flags) ? preferences?.allergen_flags : [];

    const violations: Array<{ recipeId: string; title: string; type: "allergen" | "dietary"; details: string[] }> = [];
    for (const recipe of recipes ?? []) {
      const recipeAllergens: string[] = Array.isArray(recipe.allergen_tags) ? recipe.allergen_tags : [];
      const recipeDietary: string[] = Array.isArray(recipe.dietary_tags) ? recipe.dietary_tags : [];
      const blockedAllergens = allergenFlags.filter((flag) =>
        recipeAllergens.map((a) => a?.toLowerCase()).includes(flag?.toLowerCase())
      );
      if (blockedAllergens.length) {
        violations.push({
          recipeId: recipe.id,
          title: recipe.title,
          type: "allergen",
          details: blockedAllergens
        });
      }
      if (requiredDietary.length) {
        const missing = requiredDietary.filter(
          (tag) => !recipeDietary.map((d) => d?.toLowerCase()).includes(tag?.toLowerCase())
        );
        if (missing.length) {
          violations.push({
            recipeId: recipe.id,
            title: recipe.title,
            type: "dietary",
            details: missing
          });
        }
      }
    }

    if (violations.length) {
      return jsonResponse(
        {
          error: "preference_violation",
          violations,
          correlationId
        },
        { status: 400 }
      );
    }

    const consolidatedList = aggregateIngredients(recipes ?? [], payload.peopleCountOverride);
    let listId: string | null = null;
    let replay = false;

    if (payload.persistList) {
      const idempotencyKey = getIdempotencyKey(req);
      if (!idempotencyKey) {
        return jsonResponse({ error: "idempotency_key_required", correlationId }, { status: 400 });
      }
      const listName = payload.listName?.trim() || `Menu plan ${new Date().toISOString().slice(0, 10)}`;
      const itemsPayload = consolidatedList.map((line) => ({
        label: line.name,
        desired_qty: line.quantity ?? 1,
        notes: line.packaging ?? null
      }));
      const { data: created, error: createError } = await supabase.rpc("menu_create_list", {
        _idempotency_key: idempotencyKey,
        _name: listName,
        _items: itemsPayload
      });
      if (createError) {
        const message = createError.message ?? "list_create_failed";
        if (message.includes("limit_exceeded")) {
          return jsonResponse({ error: "limit_exceeded", scope: "list_creates", correlationId }, { status: 429 });
        }
        if (message.includes("premium_required")) {
          return jsonResponse({ error: "premium_required", correlationId }, { status: 403 });
        }
        if (message.includes("idempotency_key_required")) {
          return jsonResponse({ error: "idempotency_key_required", correlationId }, { status: 400 });
        }
        console.error("menus-lists create failed", { correlationId, createError });
        return jsonResponse({ error: "list_create_failed", correlationId }, { status: 400 });
      }
      const createdRow = Array.isArray(created) ? created[0] : created;
      listId = (createdRow?.list_id as string | undefined) ?? null;
      replay = Boolean(createdRow?.replay ?? false);
      if (!listId) {
        return jsonResponse({ error: "list_create_failed", correlationId }, { status: 400 });
      }
    }

    return jsonResponse({
      consolidatedList,
      listId,
      servings: payload.peopleCountOverride ?? null,
      replay: payload.persistList ? replay : undefined,
      correlationId
    });
  } catch (error) {
    console.error("menus-lists failure", { correlationId, error });
    return jsonResponse({ error: "internal_error", correlationId }, { status: 500 });
  }
});
