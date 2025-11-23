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
    ]
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await getAuthedClient(req); // validate auth
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
    const validated = menuPromptResponseSchema.parse(response);
    console.log(
      JSON.stringify({
        event: 'menu_llm_stub',
        dishCount: parsed.dishes.length,
        people: parsed.peopleCount
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
