import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
import { menuPromptInputSchema, menuPromptResponseSchema, type MenuPromptInput, type MenuPromptResponse } from "../_shared/menu-prompt-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...corsHeaders },
    ...init
  });
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
  return { client, userId: data.user.id };
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

type PackagingUnit = {
  ingredient_key: string;
  pack_size: number | null;
  pack_unit: string | null;
  display_label: string | null;
};

type IngredientMeta = {
  key: string;
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
};

function formatPackagingLabel(meta: IngredientMeta, unit?: Pick<PackagingUnit, 'pack_size' | 'pack_unit' | 'display_label'>) {
  if (unit?.display_label) return unit.display_label;
  const packSize =
    typeof unit?.pack_size === 'number'
      ? unit.pack_size
      : typeof meta.quantity === 'number'
        ? meta.quantity
        : Number(meta.quantity) || 1;
  const packUnit = unit?.pack_unit ?? meta.unit ?? 'unit';
  const sizeLabel = packSize ? `${packSize} ${packUnit}`.trim() : packUnit;
  return `Buy ${sizeLabel} of ${meta.name}`;
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
    notes: item.notes ?? null
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

function findClarifications(payload: MenuPromptInput) {
  const clarifications: { dishKey: string; question: string }[] = [];
  payload.dishes.forEach((dish) => {
    if (!dish.cuisineStyle && /curry|rice|stew|jerk/i.test(dish.title)) {
      clarifications.push({
        dishKey: normalizeKey(dish.title) || dish.title,
        question: `Which style best matches ${dish.title}?`
      });
    }
  });
  return clarifications;
}

function buildResponse(payload: MenuPromptInput): MenuPromptResponse {
  const cards = payload.dishes.map((dish) => buildStubRecipe({
    dish: dish.title,
    people: payload.peopleCount,
    locale: payload.locale
  }));
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
  client: ReturnType<typeof createClient>,
  response: MenuPromptResponse,
  locale?: string
) {
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

  const packagingMap = new Map<string, string>();
  if (uniqueKeys.length) {
    const { data: existing } = await client
      .from('menu_packaging_units')
      .select('ingredient_key, pack_size, pack_unit, display_label')
      .in('ingredient_key', uniqueKeys);
    existing?.forEach((unit) => {
      const meta = metaByKey[unit.ingredient_key];
      if (meta) {
        packagingMap.set(unit.ingredient_key, formatPackagingLabel(meta, unit));
      }
    });

    const missingKeys = uniqueKeys.filter((key) => !packagingMap.has(key));
    if (missingKeys.length) {
      const updates = missingKeys.map((key) => {
        const meta = metaByKey[key];
        return {
          ingredientKey: key,
          packSize:
            typeof meta?.quantity === 'number'
              ? meta.quantity || 1
              : Number(meta?.quantity) || 1,
          packUnit: meta?.unit || 'unit',
          displayLabel: meta ? formatPackagingLabel(meta) : null
        };
      });
      const { data: invokeData, error: invokeError } = await client.functions.invoke('menus-packaging', {
        body: {
          locale: locale ?? 'en_US',
          updates
        }
      });
      if (!invokeError) {
        const units: PackagingUnit[] = (invokeData as any)?.units ?? (invokeData as any)?.data?.units ?? [];
        units.forEach((unit) => {
          const meta = metaByKey[unit.ingredient_key];
          if (meta) {
            packagingMap.set(unit.ingredient_key, formatPackagingLabel(meta, unit));
          }
        });
      }
    }
  }

  const consolidatedGuidance: Record<string, string> = {};
  for (const card of response.cards) {
    const guidance: string[] = [];
    for (const ingredient of card.ingredients) {
      const key = normalizeKey(ingredient.name);
      if (!key) continue;
      const label =
        packagingMap.get(key) ??
        formatPackagingLabel({ key, name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit });
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let supabase;
  let userId;
  try {
    const auth = await getAuthedClient(req); // validate auth
    supabase = auth.client;
    userId = auth.userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'auth_error';
    const status = message === 'auth_required' ? 401 : 500;
    return jsonResponse({ error: message }, { status });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const raw = await req.json();
    const parsed = menuPromptInputSchema.parse(raw);
    const response = buildResponse(parsed);
    await applyPackagingGuidance(supabase, response, parsed.locale);
    const validated = menuPromptResponseSchema.parse(response);
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
    console.log(
      JSON.stringify({
        event: 'menu_llm_stub',
        dishCount: parsed.dishes.length,
        people: parsed.peopleCount,
        clarifications: validated.clarification_needed?.length ?? 0
      })
    );
    return jsonResponse(validated);
  } catch (error) {
    if ('issues' in (error as any)) {
      return jsonResponse({ error: 'invalid_payload', details: (error as any).issues }, { status: 400 });
    }
    console.error('menus-llm failure', error);
    return jsonResponse({ error: 'internal_error' }, { status: 500 });
  }
});
