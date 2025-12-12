import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { menuPromptResponseSchema, type MenuPromptResponse, menuPromptInputSchema } from "../_shared/menu-prompt-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Idempotency-Key, x-correlation-id",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

const idempotencyKeySchema = z.string().trim().min(1).max(255);

const regenerateSchema = z.object({
  recipeId: z.string().uuid(),
  sessionId: z.string().uuid().optional().nullable(),
  servings: z.number().int().positive().optional(),
  title: z.string().min(1).optional(),
  cuisineStyle: z.string().optional().nullable(),
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init,
  });
}

function getCorrelationId(req: Request) {
  return (
    req.headers.get("x-correlation-id") ??
    req.headers.get("Idempotency-Key") ??
    crypto.randomUUID()
  );
}

function requireIdempotencyKey(req: Request) {
  const key = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  const parsed = idempotencyKeySchema.safeParse(key);
  if (!parsed.success) {
    return { key: null };
  }
  return { key: parsed.data };
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);
  const started = performance.now();

  let supabase;
  let userId;
  try {
    const auth = await getAuthedClient(req);
    supabase = auth.client;
    userId = auth.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    console.error("menu-regenerate auth error", { correlationId, message, status });
    return jsonResponse({ error: message, correlationId }, { status });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed", correlationId }, { status: 405 });
  }

  const { key: idempotencyKey } = requireIdempotencyKey(req);
  if (!idempotencyKey) {
    return jsonResponse({ error: "idempotency_key_required", correlationId }, { status: 400 });
  }

  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = regenerateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse({ error: "invalid_payload", details: parsed.error.flatten(), correlationId }, { status: 400 });
  }

  try {
    // Fetch recipe with ownership check
    const { data: recipe, error: recipeError } = await supabase
      .from("menu_recipes")
      .select("*")
      .eq("id", parsed.data.recipeId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (recipeError || !recipe) {
      return jsonResponse({ error: "recipe_not_found", correlationId }, { status: 404 });
    }

    const now = new Date().toISOString();
    const targetServings = parsed.data.servings ?? (recipe.servings?.people_count as number | undefined) ?? 1;

    const llmInput = menuPromptInputSchema.parse({
      sessionId: parsed.data.sessionId ?? null,
      locale: recipe.cuisine_style ?? null,
      peopleCount: targetServings,
      dishes: [
        {
          title: parsed.data.title ?? recipe.title,
          cuisineStyle: parsed.data.cuisineStyle ?? recipe.cuisine_style ?? null,
        },
      ],
      preferences: {},
      policy: {},
    });

    let llmResponse: MenuPromptResponse | null = null;
    let llmDurationMs: number | undefined;
    try {
      const llmStarted = performance.now();
      const { data: llmData, error: llmError } = await supabase.functions.invoke<MenuPromptResponse>("menus-llm", {
        body: llmInput,
        headers: { "x-correlation-id": correlationId },
      });
      llmDurationMs = Math.round(performance.now() - llmStarted);
      if (llmError || !llmData) {
        console.error("menu-regenerate llm_invoke_failed", { correlationId, llmError });
        throw new Error("llm_failed");
      }
      console.log(
        JSON.stringify({
          event: "menu_regenerate_llm_call",
          correlationId,
          recipeId: recipe.id,
          llmDurationMs,
          status: "ok",
        }),
      );
      llmResponse = menuPromptResponseSchema.parse(llmData);
    } catch (error) {
      console.error("menu-regenerate llm_call_failed", { correlationId, error: String(error) });
      console.log(
        JSON.stringify({
          event: "menu_regenerate_llm_call",
          correlationId,
          recipeId: recipe.id,
          llmDurationMs,
          status: "error",
        }),
      );
      return jsonResponse({ error: "regen_generation_failed", correlationId }, { status: 502 });
    }

    const nextCard = llmResponse?.cards?.[0];
    if (!nextCard) {
      return jsonResponse({ error: "no_recipe_generated", correlationId }, { status: 502 });
    }

    const updates: Record<string, unknown> = {
      idempotency_key: idempotencyKey,
      title: nextCard.title ?? recipe.title,
      cuisine_style: nextCard.cuisine_style ?? recipe.cuisine_style,
      servings: nextCard.servings ?? { people_count: targetServings },
      ingredients: nextCard.ingredients,
      method: nextCard.method,
      tips: nextCard.tips ?? [],
      packaging_notes: nextCard.summary_footer ?? recipe.packaging_notes ?? null,
      packaging_guidance: nextCard.packaging_guidance ?? [],
      version: (recipe.version ?? 1) + 1,
      origin: "llm_regen",
      edited_by_user: false,
      needs_training: true,
      updated_at: now,
      last_generated_at: now,
    };

    const { data: updated, error: updateError } = await supabase
      .from("menu_recipes")
      .update(updates)
      .eq("id", recipe.id)
      .eq("owner_id", userId)
      .select("*")
      .single();

    if (updateError) {
      console.error("menu-regenerate update failed", { correlationId, updateError });
      return jsonResponse({ error: "regen_failed", correlationId }, { status: 400 });
    }

    await supabase
      .from("menu_recipe_training_queue")
      .upsert({
        recipe_id: updated.id,
        owner_id: userId,
        origin: "llm_regen",
        version: updated.version,
        status: "pending",
        updated_at: now,
      })
      .select("recipe_id")
      .maybeSingle();

    const durationMs = Math.round(performance.now() - started);
    console.log(
      JSON.stringify({
        event: "menu_regenerate",
        correlationId,
        recipeId: updated.id,
        durationMs,
        llmDurationMs,
        source: "llm_pipeline",
      }),
    );

    return jsonResponse({ recipe: updated, correlationId, durationMs });
  } catch (error) {
    console.error("menu-regenerate failure", { error, correlationId });
    return jsonResponse({ error: "internal_error", correlationId }, { status: 500 });
  }
});
