import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { menuPromptResponseSchema, type MenuPromptResponse, menuPromptInputSchema } from "../_shared/menu-prompt-types.ts";
import {
  errorResponse,
  getCorrelationId,
  jsonResponse,
  logEvent
} from "../_shared/observability.ts";

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

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

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
  return { client, userId: data.user.id, user: data.user };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);
  const started = performance.now();

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
    console.error("menu-regenerate auth error", { correlationId, message, status });
    return respondError({ code: message, correlationId, status });
  }

  if (req.method !== "POST") {
    return respondError({ code: "method_not_allowed", correlationId, status: 405 });
  }

  const { key: idempotencyKey } = requireIdempotencyKey(req);
  if (!idempotencyKey) {
    return respondError({ code: "idempotency_key_required", correlationId, status: 400 });
  }

  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = regenerateSchema.safeParse(payload);
  if (!parsed.success) {
    return respondError({
      code: "invalid_payload",
      correlationId,
      status: 400,
      details: parsed.error.flatten()
    });
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
      return respondError({ code: "recipe_not_found", correlationId, status: 404 });
    }

    if (recipe.idempotency_key && recipe.idempotency_key === idempotencyKey) {
      return respond({ recipe, replay: true, correlationId }, { status: 200 }, correlationId);
    }

    const now = new Date().toISOString();
    const targetServings = parsed.data.servings ?? (recipe.servings?.people_count as number | undefined) ?? 1;

    const dishCuisineStyle = parsed.data.cuisineStyle ?? recipe.cuisine_style ?? undefined;
    const llmInputCandidate: Record<string, unknown> = {
      peopleCount: targetServings,
      dishes: [
        {
          title: parsed.data.title ?? recipe.title,
          ...(dishCuisineStyle ? { cuisineStyle: dishCuisineStyle } : {}),
        },
      ],
      preferences: {},
      policy: { isPremium: true, blurRecipes: false },
    };
    if (parsed.data.sessionId) {
      llmInputCandidate.sessionId = parsed.data.sessionId;
    }
    const llmInput = menuPromptInputSchema.parse(llmInputCandidate);

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
      logEvent({
        event: "menu_regenerate_llm_call",
        correlationId,
        ownerId: userId,
        entityId: recipe.id,
        durationMs: llmDurationMs,
        status: "ok"
      });
      llmResponse = menuPromptResponseSchema.parse(llmData);
    } catch (error) {
      console.error("menu-regenerate llm_call_failed", { correlationId, error: String(error) });
      logEvent({
        event: "menu_regenerate_llm_call",
        correlationId,
        ownerId: userId,
        entityId: recipe.id,
        durationMs: llmDurationMs,
        status: "error",
        errorCode: "llm_failed"
      });
      return respondError({ code: "regen_generation_failed", correlationId, status: 502 });
    }

    const nextCard = llmResponse?.cards?.[0];
    if (!nextCard) {
      return respondError({ code: "no_recipe_generated", correlationId, status: 502 });
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
      return respondError({ code: "regen_failed", correlationId, status: 400 });
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
    logEvent({
      event: "menu_regenerate",
      correlationId,
      ownerId: userId,
      entityId: updated.id,
      durationMs,
      metadata: {
        llmDurationMs,
        source: "llm_pipeline"
      }
    });

    return respond({ recipe: updated, correlationId, durationMs }, {}, correlationId);
  } catch (error) {
    console.error("menu-regenerate failure", { error, correlationId });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
