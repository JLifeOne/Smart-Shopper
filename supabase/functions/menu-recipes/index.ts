import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Idempotency-Key",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type RecipePayload = {
  title?: string;
  course?: string | null;
  cuisineStyle?: string | null;
  servings?: Record<string, unknown>;
  scaleFactor?: number;
  ingredients?: unknown[];
  method?: unknown[];
  tips?: string[];
  packagingNotes?: string | null;
  packagingGuidance?: unknown[];
  premiumRequired?: boolean;
  dietaryTags?: string[];
  allergenTags?: string[];
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init,
  });
}

async function getAuthedClient(req: Request) {
  if (!supabaseUrl || !anonKey) {
    throw new Error("supabase_not_configured");
  }
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
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
  return { client, userId: data.user.id };
}

function parseRecipeId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((segment) => segment === "menu-recipes");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    return jsonResponse({ error: message }, { status });
  }

  const url = new URL(req.url);
  const recipeId = parseRecipeId(url);

  try {
    switch (req.method) {
      case "GET": {
        if (recipeId) {
          const { data, error } = await supabase.from("menu_recipes").select("*").eq("id", recipeId).single();
          if (error) {
            return jsonResponse({ error: "recipe_not_found" }, { status: 404 });
          }
          return jsonResponse({ recipe: data });
        }
        const limit = Number(url.searchParams.get("limit") ?? 20);
        const cursor = url.searchParams.get("cursor");
        let query = supabase
          .from("menu_recipes")
          .select("*")
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false })
          .limit(Math.max(1, Math.min(50, limit)));
        if (cursor) {
          query = query.lt("updated_at", cursor);
        }
        const { data, error } = await query;
        if (error) {
          return jsonResponse({ error: "recipe_list_failed" }, { status: 400 });
        }
        return jsonResponse({ recipes: data });
      }
      case "POST": {
        const payload = (await req.json().catch(() => ({}))) as RecipePayload;
        const title = payload.title?.trim();
        if (!title) {
          return jsonResponse({ error: "title_required" }, { status: 400 });
        }
        const now = new Date().toISOString();
        const isPremiumUser =
          Boolean(user?.app_metadata?.is_menu_premium) ||
          Boolean(user?.app_metadata?.is_developer) ||
          Boolean(user?.app_metadata?.dev);
        const insertRecord = {
          owner_id: userId,
          title,
          course: payload.course ?? null,
          cuisine_style: payload.cuisineStyle ?? null,
          servings: payload.servings ?? { people_count: 1 },
          scale_factor: payload.scaleFactor ?? 1,
          ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : [],
          method: Array.isArray(payload.method) ? payload.method : [],
          tips: payload.tips ?? [],
          packaging_notes: payload.packagingNotes ?? null,
          packaging_guidance: Array.isArray(payload.packagingGuidance) ? payload.packagingGuidance : [],
          premium_required:
            payload.premiumRequired !== undefined
              ? payload.premiumRequired
              : !isPremiumUser
                ? false
                : true,
          dietary_tags: payload.dietaryTags ?? [],
          allergen_tags: payload.allergenTags ?? [],
          last_generated_at: now,
          created_at: now,
          updated_at: now
        };
        const { data, error } = await supabase.from("menu_recipes").insert(insertRecord).select("*").single();
        if (error) {
          console.error("menu_recipes insert failed", error);
          return jsonResponse({ error: error.message ?? "recipe_create_failed" }, { status: 400 });
        }
        console.log(
          JSON.stringify({
            event: "menu_recipe_created",
            ownerId: userId,
            title,
            premiumRequired: insertRecord.premium_required
          })
        );
        return jsonResponse({ recipe: data }, { status: 201 });
      }
      case "PUT": {
        if (!recipeId) {
          return jsonResponse({ error: "recipe_id_required" }, { status: 400 });
        }
        const payload = (await req.json().catch(() => ({}))) as RecipePayload;
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (payload.title) updates.title = payload.title.trim();
        if (payload.course !== undefined) updates.course = payload.course;
        if (payload.cuisineStyle !== undefined) updates.cuisine_style = payload.cuisineStyle;
        if (payload.servings) updates.servings = payload.servings;
        if (payload.scaleFactor !== undefined) updates.scale_factor = payload.scaleFactor;
        if (payload.ingredients) updates.ingredients = payload.ingredients;
        if (payload.method) updates.method = payload.method;
        if (payload.tips) updates.tips = payload.tips;
        if (payload.packagingNotes !== undefined) updates.packaging_notes = payload.packagingNotes;
        if (payload.packagingGuidance) updates.packaging_guidance = payload.packagingGuidance;
        if (payload.premiumRequired !== undefined) updates.premium_required = payload.premiumRequired;
        if (payload.dietaryTags) updates.dietary_tags = payload.dietaryTags;
        if (payload.allergenTags) updates.allergen_tags = payload.allergenTags;

        const { data, error } = await supabase
          .from("menu_recipes")
          .update(updates)
          .eq("id", recipeId)
          .eq("owner_id", userId)
          .select("*")
          .single();
        if (error) {
          return jsonResponse({ error: "recipe_update_failed" }, { status: 400 });
        }
        return jsonResponse({ recipe: data });
      }
      case "DELETE": {
        if (!recipeId) {
          return jsonResponse({ error: "recipe_id_required" }, { status: 400 });
        }
        const { error } = await supabase.from("menu_recipes").delete().eq("id", recipeId).eq("owner_id", userId);
        if (error) {
          return jsonResponse({ error: "recipe_delete_failed" }, { status: 400 });
        }
        return jsonResponse({ success: true });
      }
      default:
        return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
    }
  } catch (error) {
    console.error("menu-recipes failure", error);
    return jsonResponse({ error: "internal_error" }, { status: 500 });
  }
});
