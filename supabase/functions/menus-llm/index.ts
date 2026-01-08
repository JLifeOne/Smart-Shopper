import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { MENU_ASSISTANT_PROMPT } from "../_shared/menu-assistant-prompt.ts";
import { menuPromptInputSchema, menuPromptResponseSchema, type MenuPromptInput, type MenuPromptResponse } from "../_shared/menu-prompt-types.ts";
import {
  formatPackagingLabel,
  normalizeKey,
  sanitizeResponseShape,
  type IngredientMeta,
  type PackagingUnitInput
} from "../_shared/menu-llm-utils.ts";
import {
  errorResponse,
  getCorrelationId,
  jsonResponse,
  logEvent
} from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, Idempotency-Key, x-correlation-id"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const llmUrl = Deno.env.get("MENU_LLM_URL");
const llmApiKey = Deno.env.get("MENU_LLM_API_KEY");
const llmProvider = (Deno.env.get("MENU_LLM_PROVIDER") ?? "custom").toLowerCase();
const resolvedLlmProvider = llmProvider === "openai" ? "openai" : "custom";
const llmModel = Deno.env.get("MENU_LLM_MODEL");
const llmBaseUrl = Deno.env.get("MENU_LLM_BASE_URL") ?? "https://api.openai.com/v1";

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

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
  return { client, userId: data.user.id };
}

type PackagingUnit = PackagingUnitInput & {
  ingredient_key: string;
};

type StyleChoiceRow = {
  dish_key: string;
  style_choice: string;
};

function coerceStyleChoiceRow(value: unknown): StyleChoiceRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const dishKey = typeof row.dish_key === "string" ? row.dish_key : null;
  const styleChoice = typeof row.style_choice === "string" ? row.style_choice : null;
  if (!dishKey || !styleChoice) return null;
  return { dish_key: dishKey, style_choice: styleChoice };
}

function coercePackagingUnit(value: unknown): PackagingUnit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const ingredientKey = typeof row.ingredient_key === "string" ? row.ingredient_key : null;
  if (!ingredientKey) return null;
  const packSize =
    typeof row.pack_size === "number" || typeof row.pack_size === "string"
      ? row.pack_size
      : null;
  const packUnit = typeof row.pack_unit === "string" ? row.pack_unit : null;
  const displayLabel = typeof row.display_label === "string" ? row.display_label : null;
  return {
    ingredient_key: ingredientKey,
    pack_size: packSize,
    pack_unit: packUnit,
    display_label: displayLabel
  };
}


async function loadStyleChoices(
  client: SupabaseClient,
  userId: string,
  dishes: { title: string; cuisineStyle?: string | null }[]
) {
  const keys = dishes.map((d) => normalizeKey(d.title)).filter(Boolean);
  if (!keys.length) return {};
  const { data, error } = await client
    .from('menu_style_choices')
    .select('dish_key, style_choice')
    .eq('owner_id', userId)
    .in('dish_key', keys);
  if (error || !data) {
    return {};
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.reduce<Record<string, string>>((acc, row) => {
    const typed = coerceStyleChoiceRow(row);
    if (typed) {
      acc[typed.dish_key] = typed.style_choice;
    }
    return acc;
  }, {});
}

function buildStubRecipe(input: { dish: string; people: number; locale?: string }): MenuPromptResponse['cards'][number] {
  const baseTitle = input.dish.trim();
  const slug = baseTitle.toLowerCase().replace(/\s+/g, '-');
  const ingredients = [
    { name: `${baseTitle} ingredient`, quantity: input.people, unit: 'unit' },
    { name: 'Salt', quantity: 1, unit: 'tsp' }
  ];
  const listLines = ingredients.map((item) => ({
    name: item.name,
    quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
    unit: item.unit ?? null,
    notes: null
  }));
  return {
    id: slug,
    title: baseTitle,
    course: 'Main',
    cuisine_style: input.locale ?? null,
    servings: {
      people_count: input.people,
      portion_size_per_person: '1 plate',
      scale_factor: 1
    },
    lock_scope: false,
    ingredients,
    method: [
      { step: 1, text: `Prepare ${baseTitle} base.` },
      { step: 2, text: 'Cook until done.' }
    ],
    total_time_minutes: 30,
    tips: ['Adjust seasoning to taste.'],
    list_lines: listLines,
    packaging_guidance: [`Buy ${input.people} x 1 unit ${baseTitle}`],
    summary_footer: `Serves ${input.people} people; portion ~1 plate per person.`
  };
}

function clarificationOptionsFor(title: string) {
  if (/curry/i.test(title)) return ['Jamaican', 'Indian', 'Thai'];
  if (/rice|pilaf|pilau|pulao/i.test(title)) return ['Jasmine', 'Basmati', 'Long grain', 'Brown'];
  if (/stew|jerk/i.test(title)) return ['Jamaican', 'Creole', 'West African'];
  return ['Classic', 'Spicy', 'Mild'];
}

function findClarifications(payload: MenuPromptInput) {
  const clarifications: { dishKey: string; question: string; options?: string[] }[] = [];
  payload.dishes.forEach((dish) => {
    if (!dish.cuisineStyle && /curry|rice|stew|jerk/i.test(dish.title)) {
      const dishKey = normalizeKey(dish.title) || dish.title;
      clarifications.push({
        dishKey,
        question: `Which style best matches ${dish.title}?`,
        options: clarificationOptionsFor(dish.title)
      });
    }
  });
  return clarifications;
}

function buildResponse(payload: MenuPromptInput): MenuPromptResponse {
  const cards = payload.dishes.map((dish) =>
    buildStubRecipe({
      dish: dish.title,
      people: payload.peopleCount,
      locale: dish.cuisineStyle ?? payload.locale
    })
  );
  const consolidated = cards
    .flatMap((card) => card.list_lines)
    .reduce<MenuPromptResponse['consolidated_list']>((acc, line) => {
      const key = `${line.name}|${line.unit ?? ''}`;
      const current = acc.find((entry) => `${entry.name}|${entry.unit ?? ''}` === key);
      if (current && line.quantity && current.quantity) {
        current.quantity += line.quantity;
      } else if (!current) {
        acc.push({ ...line });
      }
      return acc;
    }, []);
  const clarifications = findClarifications(payload);
  return {
    cards,
    consolidated_list: consolidated,
    menus: [
      {
        id: 'menu-auto',
        title: 'Suggested combo',
        dishes: cards.map((card) => card.title),
        list_lines: consolidated
      }
    ],
    clarification_needed: clarifications.length ? clarifications : undefined
  };
}

async function applyPackagingGuidance(
  client: SupabaseClient,
  response: MenuPromptResponse,
  locale?: string
) {
  const normalizedLocale = locale && locale.trim().length ? locale.trim() : 'en_US';
  const ingredientMeta: IngredientMeta[] = [];
  for (const card of response.cards) {
    card.ingredients.forEach((ingredient) => {
      const key = normalizeKey(ingredient.name);
      if (key) {
        ingredientMeta.push({
          key,
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit
        });
      }
    });
  }

  const uniqueKeys = Array.from(new Set(ingredientMeta.map((item) => item.key)));
  const metaByKey = ingredientMeta.reduce<Record<string, IngredientMeta>>((acc, item) => {
    if (!acc[item.key]) acc[item.key] = item;
    return acc;
  }, {});

  const packagingUnitsByKey = new Map<string, PackagingUnit>();

  if (uniqueKeys.length) {
    const { data: profiles, error: profileError } = await client
      .from('menu_packaging_profiles')
      .select('id, locale, store_id, created_at')
      .eq('locale', normalizedLocale)
      .order('created_at', { ascending: false })
      .limit(10);

    if (profileError) {
      console.error("menu_packaging_profiles select failed", { locale: normalizedLocale, profileError });
    }

    const selectedProfileId =
      profiles?.find((profile) => !profile.store_id)?.id ?? profiles?.[0]?.id ?? null;

    if (selectedProfileId) {
      const { data: existing } = await client
        .from('menu_packaging_units')
        .select('ingredient_key, pack_size, pack_unit, display_label')
        .eq('profile_id', selectedProfileId)
        .in('ingredient_key', uniqueKeys);

      (existing ?? []).forEach((unit) => {
        const typed = coercePackagingUnit(unit);
        if (typed) {
          packagingUnitsByKey.set(typed.ingredient_key, typed);
        }
      });
    }
  }

  const consolidatedGuidance: Record<string, string> = {};
  for (const card of response.cards) {
    const guidance: string[] = [];
    for (const ingredient of card.ingredients) {
      const key = normalizeKey(ingredient.name);
      if (!key) continue;
      const unit = packagingUnitsByKey.get(key);
      const label = formatPackagingLabel(
        { key, name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit },
        unit
      );
      guidance.push(label);
      consolidatedGuidance[key] = label;
    }
    card.packaging_guidance = guidance;
  }

  if (Array.isArray(response.consolidated_list)) {
    response.consolidated_list = response.consolidated_list.map((line) => {
      const key = normalizeKey(line.name);
      return {
        ...line,
        packaging: consolidatedGuidance[key] ?? line.packaging ?? null
      };
    });
  }
}

async function callCustomLLM(
  payload: MenuPromptInput,
  requestId: string,
  correlationId: string,
  ownerId?: string
) {
  if (!llmUrl) throw new Error("llm_url_missing");
  const startedAt = performance.now();
  const timeoutMs = Number(Deno.env.get("MENU_LLM_TIMEOUT_MS") ?? 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(llmUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        ...(llmApiKey ? { Authorization: `Bearer ${llmApiKey}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error("llm_timeout", { requestId, correlationId, timeoutMs });
      throw new Error("llm_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("llm_invalid_json", { requestId, correlationId, text: text.slice(0, 500) });
    throw new Error("llm_invalid_json");
  }
  if (!response.ok) {
    console.error("llm_error", { requestId, correlationId, status: response.status, body: json });
    throw new Error("llm_failed");
  }
  const durationMs = Math.round(performance.now() - startedAt);
  logEvent({
    event: "menu_llm_call",
    correlationId,
    ownerId,
    provider: "custom",
    durationMs,
    metadata: { requestId }
  });
  return json as unknown;
}

async function callOpenAI(
  payload: MenuPromptInput,
  requestId: string,
  correlationId: string,
  ownerId?: string
) {
  if (!llmApiKey) throw new Error("llm_api_key_missing");
  const model = llmModel ?? "gpt-4o-mini";
  const baseUrl = (llmBaseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const startedAt = performance.now();
  const timeoutMs = Number(Deno.env.get("MENU_LLM_TIMEOUT_MS") ?? 15000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const requestBody = {
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MENU_ASSISTANT_PROMPT },
      {
        role: "user",
        content: `Input JSON:\n${JSON.stringify(payload)}\n\nReturn ONLY valid JSON. Do not wrap in markdown.`
      }
    ]
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${llmApiKey}`,
        "x-correlation-id": correlationId
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("llm_timeout", { requestId, correlationId, timeoutMs, provider: "openai" });
      throw new Error("llm_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("llm_error", { requestId, correlationId, provider: "openai", status: response.status, body: json });
    throw new Error("llm_failed");
  }

  const content = (json as any)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim().length) {
    console.error("llm_empty_response", { requestId, correlationId, provider: "openai" });
    throw new Error("llm_invalid_json");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error("llm_invalid_json", { requestId, correlationId, provider: "openai", text: content.slice(0, 500) });
    throw new Error("llm_invalid_json");
  }

  const durationMs = Math.round(performance.now() - startedAt);
  logEvent({
    event: "menu_llm_call",
    correlationId,
    ownerId,
    provider: "openai",
    durationMs,
    metadata: { requestId, model }
  });
  return parsed;
}

async function callLLM(payload: MenuPromptInput, requestId: string, correlationId: string, ownerId?: string) {
  if (resolvedLlmProvider === "openai") {
    return callOpenAI(payload, requestId, correlationId, ownerId);
  }
  return callCustomLLM(payload, requestId, correlationId, ownerId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);

  let supabase;
  let userId;
  try {
    const auth = await getAuthedClient(req); // validate auth
    supabase = auth.client;
    userId = auth.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'auth_error';
    const status = message === 'auth_required' ? 401 : 500;
    return respondError({ code: message, correlationId, status });
  }

  if (req.method !== 'POST') {
    return respondError({ code: 'method_not_allowed', correlationId, status: 405 });
  }

  try {
    const { data: premiumData, error: premiumError } = await supabase.rpc("menu_is_premium_user");
    if (premiumError) {
      console.error("menu_is_premium_user rpc failed", { correlationId, premiumError });
    }
    const isPremiumUser = Boolean(premiumData);

    const raw = await req.json().catch(() => ({}));
    const parsedResult = menuPromptInputSchema.safeParse(raw);
    if (!parsedResult.success) {
      return respondError({
        code: "invalid_payload",
        correlationId,
        status: 400,
        details: parsedResult.error.flatten()
      });
    }
    const parsed = parsedResult.data;
    if (!parsed.sessionId) {
      const today = new Date().toISOString().slice(0, 10);
      const limit = isPremiumUser ? 10 : 3;
      const { data: usageData, error: usageError } = await supabase.rpc("increment_menu_usage", {
        _owner_id: userId,
        _usage_date: today,
        _uploads_inc: 1,
        _list_inc: 0,
        _upload_limit: limit,
        _list_limit: limit
      });
      if (usageError) {
        const message = usageError.message ?? "usage_increment_failed";
        if (message.includes("not_owner")) {
          return respondError({ code: "not_owner", correlationId, status: 403 });
        }
        console.error("increment_menu_usage failed", { correlationId, usageError });
        return respondError({ code: "usage_increment_failed", correlationId, status: 500 });
      }
      const usageRow = Array.isArray(usageData) ? usageData[0] : usageData;
      if (!usageRow) {
        logEvent({
          event: "menu_llm_limit_exceeded",
          correlationId,
          ownerId: userId,
          errorCode: "limit_exceeded",
          metadata: { scope: "uploads" }
        });
        return respondError({
          code: "limit_exceeded",
          correlationId,
          status: 429,
          details: { scope: "uploads" }
        });
      }
    }
    const styleChoices = await loadStyleChoices(supabase, userId, parsed.dishes);
    const hydrated = {
      ...parsed,
      dishes: parsed.dishes.map((dish) => {
        const key = normalizeKey(dish.title);
        const style = dish.cuisineStyle ?? (key ? styleChoices[key] : undefined) ?? dish.cuisineStyle ?? null;
        return { ...dish, cuisineStyle: style ?? undefined };
      })
    };
    const requestId = crypto.randomUUID();
    let generated: MenuPromptResponse | null = null;
    let usedFallback = false;
    try {
      const llmPayload = {
        ...hydrated,
        preferences: hydrated.preferences ?? {},
        policy: hydrated.policy ?? { isPremium: isPremiumUser, blurRecipes: false }
      };
      const llmRaw = await callLLM(llmPayload, requestId, correlationId, userId);
      generated = sanitizeResponseShape(menuPromptResponseSchema.parse(llmRaw));
      const hasEmptyCards =
        generated.cards.length === 0 ||
        generated.cards.some((card) => card.ingredients.length === 0 || card.method.length === 0);
      if (hasEmptyCards) {
        throw new Error("llm_empty_cards");
      }
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : "llm_failed";
      console.error("llm_parse_failed", { requestId, correlationId, error: String(error) });
      logEvent({
        event: "menu_llm_fallback",
        correlationId,
        ownerId: userId,
        provider: resolvedLlmProvider,
        errorCode,
        metadata: { requestId }
      });
      generated = buildResponse(hydrated);
      usedFallback = true;
    }
    const packagingStartedAt = performance.now();
    await applyPackagingGuidance(supabase, generated, parsed.locale);
    logEvent({
      event: "menu_packaging_applied",
      correlationId,
      ownerId: userId,
      durationMs: Math.round(performance.now() - packagingStartedAt),
      metadata: {
        cards: generated.cards.length,
        listLines: generated.consolidated_list?.length ?? 0
      }
    });
    const validated = menuPromptResponseSchema.parse(generated);
    if (parsed.sessionId) {
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        card_ids: validated.cards.map((card) => card.id)
      };
      if (validated.clarification_needed?.length) {
        updatePayload.status = 'needs_clarification';
        updatePayload.warnings = validated.clarification_needed.map((item) => item.question);
        updatePayload.payload = { clarifications: validated.clarification_needed };
      } else {
        updatePayload.status = 'ready';
        updatePayload.warnings = [];
        updatePayload.payload = {};
      }
      await supabase
        .from('menu_sessions')
        .update(updatePayload)
        .eq('id', parsed.sessionId)
        .eq('owner_id', userId);
    }
    logEvent({
      event: "menu_llm_response",
      correlationId,
      ownerId: userId,
      sessionId: parsed.sessionId ?? null,
      provider: resolvedLlmProvider,
      metadata: {
        dishCount: parsed.dishes.length,
        people: parsed.peopleCount,
        clarifications: validated.clarification_needed?.length ?? 0,
        usedFallback
      }
    });
    return respond({ ...validated, correlationId }, {}, correlationId);
  } catch (error) {
    console.error('menus-llm failure', { correlationId, error });
    logEvent({
      event: "menu_llm_error",
      correlationId,
      ownerId: userId,
      errorCode: "internal_error"
    });
    return respondError({ code: "internal_error", correlationId, status: 500 });
  }
});
