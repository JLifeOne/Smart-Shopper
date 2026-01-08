import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  errorResponse as baseErrorResponse,
  getCorrelationId,
  jsonResponse as baseJsonResponse,
  logEvent
} from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Idempotency-Key, x-correlation-id",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

const jsonResponse = (body: unknown, init: ResponseInit = {}, correlationId?: string) => {
  const resolvedCorrelationId =
    correlationId ??
    (body && typeof body === "object" && "correlationId" in body
      ? String((body as { correlationId?: unknown }).correlationId)
      : undefined);
  return baseJsonResponse(body, init, corsHeaders, resolvedCorrelationId);
};

const errorResponse = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  baseErrorResponse({ ...options, corsHeaders });

const idempotencyKeySchema = z.string().trim().min(1).max(255);
const isoDateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_timestamp");

const servingsSchema = z
  .object({
    people_count: z.number().int().positive().default(1),
    portion_size_per_person: z.string().nullable().optional(),
    scale_factor: z.number().positive().nullable().optional(),
  })
  .partial()
  .transform((value) => ({
    people_count: value.people_count ?? 1,
    portion_size_per_person: value.portion_size_per_person ?? null,
    scale_factor: value.scale_factor ?? null,
  }));

const ingredientSchema = z.object({
  name: z.string().min(1, "ingredient_name_required"),
  quantity: z.union([z.number(), z.string()]).optional().nullable(),
  unit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const methodStepSchema = z.object({
  step: z.number().int().positive(),
  text: z.string().min(1, "method_text_required"),
});

const packagingGuidanceSchema = z.union([
  z.string(),
  z.object({
    text: z.string().optional().nullable(),
    label: z.string().optional().nullable(),
    packaging: z.string().optional().nullable(),
  }),
]);

const baseRecipeSchema = z.object({
  title: z.string().trim().min(1, "title_required"),
  course: z.string().trim().min(1).optional().nullable(),
  cuisineStyle: z.string().trim().min(1).optional().nullable(),
  servings: servingsSchema.optional(),
  scaleFactor: z.number().positive().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  method: z.array(methodStepSchema).optional(),
  tips: z.array(z.string()).optional(),
  packagingNotes: z.string().optional().nullable(),
  packagingGuidance: z.array(packagingGuidanceSchema).optional(),
  premiumRequired: z.boolean().optional(),
  dietaryTags: z.array(z.string()).optional(),
  allergenTags: z.array(z.string()).optional(),
  source: z.string().trim().optional().nullable(),
  version: z.number().int().positive().optional(),
  origin: z.enum(["llm_initial", "llm_regen", "user_edit", "user_scale"]).optional(),
  editedByUser: z.boolean().optional(),
  needsTraining: z.boolean().optional(),
  expectedUpdatedAt: isoDateString.optional(),
});

const createRecipeSchema = baseRecipeSchema.extend({
  title: baseRecipeSchema.shape.title,
});

const updateRecipeSchema = baseRecipeSchema.extend({
  title: baseRecipeSchema.shape.title.optional(),
});

// Normalization maps client payloads (camelCase + snake_case variants) into a single shape.
// This is still *untrusted* input; Zod schemas are the validation boundary.
type NormalizedRecipePayload = Record<string, unknown>;

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

function parseRecipeId(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((segment) => segment === "menu-recipes");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

function normalizeRecipePayload(raw: Record<string, unknown>): NormalizedRecipePayload {
  const snake = raw as Record<string, unknown> & {
    cuisine_style?: unknown;
    scale_factor?: unknown;
    packaging_notes?: unknown;
    packaging_guidance?: unknown;
    premium_required?: unknown;
    dietary_tags?: unknown;
    allergen_tags?: unknown;
    edited_by_user?: unknown;
    needs_training?: unknown;
    updated_at?: unknown;
  };

  return {
    title: raw.title,
    course: raw.course,
    cuisineStyle: raw.cuisineStyle ?? snake.cuisine_style,
    servings: raw.servings,
    scaleFactor: raw.scaleFactor ?? snake.scale_factor,
    ingredients: raw.ingredients,
    method: raw.method,
    tips: raw.tips,
    packagingNotes: raw.packagingNotes ?? snake.packaging_notes,
    packagingGuidance: raw.packagingGuidance ?? snake.packaging_guidance,
    premiumRequired: raw.premiumRequired ?? snake.premium_required,
    dietaryTags: raw.dietaryTags ?? snake.dietary_tags,
    allergenTags: raw.allergenTags ?? snake.allergen_tags,
    source: raw.source,
    version: raw.version,
    origin: raw.origin,
    editedByUser: raw.editedByUser ?? snake.edited_by_user,
    needsTraining: raw.needsTraining ?? snake.needs_training,
    expectedUpdatedAt: raw.updatedAt ?? snake.updated_at ?? (raw as any).expectedUpdatedAt,
  };
}

function requireIdempotencyKey(req: Request) {
  const key = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  const parsed = idempotencyKeySchema.safeParse(key);
  if (!parsed.success) {
    return { error: null };
  }
  return { key: parsed.data };
}

function buildServings(
  servings?: z.infer<typeof servingsSchema>,
  scaleFactorOverride?: number,
  existing?: Record<string, unknown> | null
) {
  const existingServings = (existing ?? {}) as Record<string, unknown>;
  const base = servings ?? (existingServings as z.infer<typeof servingsSchema>) ?? { people_count: 1 };
  const peopleCount = typeof base.people_count === "number" && base.people_count > 0 ? base.people_count : 1;
  const resolvedScaleFactor =
    scaleFactorOverride ??
    (typeof base.scale_factor === "number" ? base.scale_factor : undefined) ??
    (typeof existingServings.scale_factor === "number" ? (existingServings.scale_factor as number) : undefined) ??
    1;
  return {
    people_count: peopleCount,
    portion_size_per_person: base.portion_size_per_person ?? existingServings.portion_size_per_person ?? null,
    scale_factor: resolvedScaleFactor,
  };
}

function escapeLike(value: string) {
  return value.replace(/[%_]/g, "\\$&");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let supabase;
  let userId;
  let user;
  const correlationId = getCorrelationId(req);
  try {
    const auth = await getAuthedClient(req);
    supabase = auth.client;
    userId = auth.userId;
    user = auth.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    console.error("menu-recipes auth error", { correlationId, message, status });
    return errorResponse({ code: message, correlationId, status });
  }

  const url = new URL(req.url);
  const recipeId = parseRecipeId(url);
  const requestId = correlationId;

  try {
    switch (req.method) {
      case "GET": {
        if (recipeId) {
        const { data, error } = await supabase
          .from("menu_recipes")
          .select("*")
          .eq("id", recipeId)
          .eq("owner_id", userId)
          .maybeSingle();
          if (error) {
            console.error("menu_recipes fetch failed", { error, requestId });
            return errorResponse({ code: "recipe_not_found", correlationId, status: 404 });
          }
          if (!data) {
            return errorResponse({ code: "recipe_not_found", correlationId, status: 404 });
          }
          return jsonResponse({ recipe: data, correlationId });
        }
        const limitParam = Number(url.searchParams.get("limit") ?? 20);
        const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 20;
        const cursor = url.searchParams.get("cursor");
        const course = url.searchParams.get("course");
        const cuisineStyle = url.searchParams.get("cuisineStyle") ?? url.searchParams.get("cuisine_style");
        const search = url.searchParams.get("search");
        if (cursor && Number.isNaN(Date.parse(cursor))) {
          return errorResponse({ code: "invalid_cursor", correlationId, status: 400 });
        }
        let query = supabase
          .from("menu_recipes")
          .select("*")
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
        if (cursor) {
          query = query.lt("updated_at", cursor);
        }
        if (course) {
          query = query.eq("course", course);
        }
        if (cuisineStyle) {
          query = query.eq("cuisine_style", cuisineStyle);
        }
        if (search) {
          query = query.ilike("title", `%${escapeLike(search)}%`);
        }
        const { data, error } = await query;
        if (error) {
          console.error("menu_recipes list failed", { error, requestId });
          return errorResponse({ code: "recipe_list_failed", correlationId, status: 400 });
        }
        const nextCursor = data.length === limit ? data[data.length - 1]?.updated_at ?? null : null;
        return jsonResponse({ recipes: data, nextCursor, correlationId });
      }
      case "POST": {
        const { key: idempotencyKey } = requireIdempotencyKey(req);
        if (!idempotencyKey) {
          return errorResponse({ code: "idempotency_key_required", correlationId, status: 400 });
        }

        const existing = await supabase
          .from("menu_recipes")
          .select("*")
          .eq("owner_id", userId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing.error && existing.error.code !== "PGRST116") {
          console.error("menu_recipes idempotency lookup failed", { error: existing.error, requestId });
          return errorResponse({ code: "recipe_create_failed", correlationId, status: 400 });
        }
        if (existing.data) {
          return jsonResponse({ recipe: existing.data, replay: true, correlationId });
        }

        const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const normalized = normalizeRecipePayload(rawBody);
        const parsed = createRecipeSchema.safeParse(normalized);
        if (!parsed.success) {
          return errorResponse({
            code: "invalid_payload",
            correlationId,
            status: 400,
            details: parsed.error.flatten()
          });
        }
        const now = new Date().toISOString();
        const servings = buildServings(parsed.data.servings, parsed.data.scaleFactor);
        const scaleFactor = servings.scale_factor ?? parsed.data.scaleFactor ?? 1;
        const insertRecord = {
          owner_id: userId,
          idempotency_key: idempotencyKey,
          title: parsed.data.title,
          course: parsed.data.course ?? null,
          cuisine_style: parsed.data.cuisineStyle ?? null,
          servings,
          scale_factor: scaleFactor,
          ingredients: Array.isArray(parsed.data.ingredients) ? parsed.data.ingredients : [],
          method: Array.isArray(parsed.data.method) ? parsed.data.method : [],
          tips: parsed.data.tips ?? [],
          packaging_notes: parsed.data.packagingNotes ?? null,
          packaging_guidance: Array.isArray(parsed.data.packagingGuidance)
            ? parsed.data.packagingGuidance
            : [],
          premium_required: false,
          dietary_tags: parsed.data.dietaryTags ?? [],
          allergen_tags: parsed.data.allergenTags ?? [],
          source: parsed.data.source ?? "user",
          last_generated_at: now,
          created_at: now,
          updated_at: now,
          version: 1,
          origin: parsed.data.origin ?? "llm_initial",
          edited_by_user: parsed.data.editedByUser ?? false,
          needs_training: parsed.data.needsTraining ?? false,
        };

        const { data, error } = await supabase.from("menu_recipes").insert(insertRecord).select("*").single();
        if (error) {
          console.error("menu_recipes insert failed", { error, requestId });
          if (error.code === "23505") {
            const replay = await supabase
              .from("menu_recipes")
              .select("*")
              .eq("owner_id", userId)
              .eq("idempotency_key", idempotencyKey)
              .maybeSingle();
            if (replay.data) {
              return jsonResponse({ recipe: replay.data, replay: true, correlationId });
            }
          }
          return errorResponse({ code: "recipe_create_failed", correlationId, status: 400 });
        }
        if (data.needs_training) {
          await supabase
            .from("menu_recipe_training_queue")
            .upsert({
              recipe_id: data.id,
              owner_id: userId,
              origin: data.origin ?? "user_edit",
              version: data.version,
              status: "pending",
              updated_at: now,
            })
            .select("recipe_id")
            .maybeSingle();
        }
        logEvent({
          event: "menu_recipe_created",
          correlationId,
          ownerId: userId,
          entityId: data.id,
          metadata: {
            title: insertRecord.title,
            premiumRequired: insertRecord.premium_required,
            requestId
          }
        });
        return jsonResponse({ recipe: data, correlationId }, { status: 201 });
      }
      case "PUT": {
        if (!recipeId) {
          return errorResponse({ code: "recipe_id_required", correlationId, status: 400 });
        }
        const { key: updateIdemKey } = requireIdempotencyKey(req);
        if (!updateIdemKey) {
          return errorResponse({ code: "idempotency_key_required", correlationId, status: 400 });
        }

        const rawBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        const normalized = normalizeRecipePayload(rawBody);
        const parsed = updateRecipeSchema.safeParse(normalized);
        if (!parsed.success) {
          return errorResponse({
            code: "invalid_payload",
            correlationId,
            status: 400,
            details: parsed.error.flatten()
          });
        }

        const existing = await supabase
          .from("menu_recipes")
          .select("*")
          .eq("id", recipeId)
          .eq("owner_id", userId)
          .maybeSingle();
        if (existing.error) {
          console.error("menu_recipes fetch for update failed", { error: existing.error, requestId });
          return errorResponse({ code: "recipe_not_found", correlationId, status: 404 });
        }
        if (!existing.data) {
          return errorResponse({ code: "recipe_not_found", correlationId, status: 404 });
        }
        if (
          parsed.data.version &&
          typeof existing.data.version === "number" &&
          parsed.data.version !== existing.data.version
        ) {
          return errorResponse({ code: "version_mismatch", correlationId, status: 409 });
        }
        if (parsed.data.expectedUpdatedAt && parsed.data.expectedUpdatedAt !== existing.data.updated_at) {
          return errorResponse({ code: "stale_update", correlationId, status: 409 });
        }

        const baseVersion = typeof existing.data.version === "number" ? existing.data.version : 1;
        const targetServings =
          parsed.data.servings || parsed.data.scaleFactor !== undefined
            ? buildServings(parsed.data.servings, parsed.data.scaleFactor, existing.data.servings)
            : null;
        const updates: Record<string, unknown> = {
          version: baseVersion + 1,
        };
        if (parsed.data.title !== undefined) updates.title = parsed.data.title;
        if (parsed.data.course !== undefined) updates.course = parsed.data.course ?? null;
        if (parsed.data.cuisineStyle !== undefined) updates.cuisine_style = parsed.data.cuisineStyle ?? null;
        if (targetServings) {
          updates.servings = targetServings;
          updates.scale_factor =
            targetServings.scale_factor ??
            parsed.data.scaleFactor ??
            existing.data.scale_factor ??
            1;
        } else if (parsed.data.scaleFactor !== undefined) {
          const scaleFactor = parsed.data.scaleFactor;
          updates.scale_factor = scaleFactor;
          updates.servings = {
            ...(existing.data.servings ?? { people_count: 1, portion_size_per_person: null }),
            scale_factor: scaleFactor,
          };
        }
        if (parsed.data.ingredients !== undefined) {
          updates.ingredients = Array.isArray(parsed.data.ingredients) ? parsed.data.ingredients : [];
        }
        if (parsed.data.method !== undefined) {
          updates.method = Array.isArray(parsed.data.method) ? parsed.data.method : [];
        }
        if (parsed.data.tips !== undefined) {
          updates.tips = parsed.data.tips ?? [];
        }
        if (parsed.data.packagingNotes !== undefined) {
          updates.packaging_notes = parsed.data.packagingNotes ?? null;
        }
        if (parsed.data.packagingGuidance !== undefined) {
          updates.packaging_guidance = Array.isArray(parsed.data.packagingGuidance)
            ? parsed.data.packagingGuidance
            : [];
        }
        if (parsed.data.dietaryTags !== undefined) {
          updates.dietary_tags = parsed.data.dietaryTags ?? [];
        }
        if (parsed.data.allergenTags !== undefined) {
          updates.allergen_tags = parsed.data.allergenTags ?? [];
        }
        if (parsed.data.source !== undefined) {
          updates.source = parsed.data.source ?? "user";
        }
        if (parsed.data.origin !== undefined) {
          updates.origin = parsed.data.origin;
        }
        if (parsed.data.editedByUser !== undefined) {
          updates.edited_by_user = parsed.data.editedByUser;
        }
        if (parsed.data.needsTraining !== undefined) {
          updates.needs_training = parsed.data.needsTraining;
        }

        let updateQuery = supabase.from("menu_recipes").update(updates).eq("id", recipeId).eq("owner_id", userId);
        updateQuery =
          parsed.data.expectedUpdatedAt !== undefined
            ? updateQuery.eq("updated_at", parsed.data.expectedUpdatedAt)
            : updateQuery.eq("version", baseVersion);

        const { data, error } = await updateQuery.select("*").single();
        if (error) {
          if (error.code === "PGRST116") {
            const conflictError = parsed.data.expectedUpdatedAt ? "stale_update" : "version_conflict";
            return errorResponse({ code: conflictError, correlationId, status: 409 });
          }
          console.error("menu_recipes update failed", { error, requestId });
          return errorResponse({ code: "recipe_update_failed", correlationId, status: 400 });
        }
        if (data.needs_training) {
          await supabase
            .from("menu_recipe_training_queue")
            .upsert({
              recipe_id: data.id,
              owner_id: userId,
              origin: data.origin ?? "user_edit",
              version: data.version,
              status: "pending",
              updated_at: new Date().toISOString(),
            })
            .select("recipe_id")
            .maybeSingle();
        }
        logEvent({
          event: "menu_recipe_updated",
          correlationId,
          ownerId: userId,
          entityId: data.id,
          status: "updated",
          metadata: { requestId }
        });
        return jsonResponse({ recipe: data, correlationId });
      }
      case "DELETE": {
        if (!recipeId) {
          return errorResponse({ code: "recipe_id_required", correlationId, status: 400 });
        }
        const { key: deleteIdemKey } = requireIdempotencyKey(req);
        if (!deleteIdemKey) {
          return errorResponse({ code: "idempotency_key_required", correlationId, status: 400 });
        }

        const existing = await supabase
          .from("menu_recipes")
          .select("id")
          .eq("id", recipeId)
          .eq("owner_id", userId)
          .maybeSingle();
        if (existing.error) {
          console.error("menu_recipes lookup for delete failed", { error: existing.error, requestId });
          return errorResponse({ code: "recipe_not_found", correlationId, status: 404 });
        }
        if (!existing.data) {
          return errorResponse({ code: "recipe_not_found", correlationId, status: 404 });
        }

        const { error } = await supabase
          .from("menu_recipes")
          .delete()
          .eq("id", recipeId)
          .eq("owner_id", userId);
        if (error) {
          console.error("menu_recipes delete failed", { error, requestId });
          return errorResponse({ code: "recipe_delete_failed", correlationId, status: 400 });
        }
        logEvent({
          event: "menu_recipe_deleted",
          correlationId,
          ownerId: userId,
          entityId: recipeId,
          status: "deleted",
          metadata: { requestId }
        });
        return jsonResponse({ success: true, correlationId });
      }
      default:
        return errorResponse({ code: "method_not_allowed", correlationId, status: 405 });
    }
  } catch (error) {
    console.error("menu-recipes failure", { error, requestId, correlationId });
    return errorResponse({ code: "internal_error", correlationId, status: 500 });
  }
});
