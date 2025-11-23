import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

type PolicyResponse = {
  policy: {
    isPremium: boolean;
    accessLevel: "full" | "title_only";
    blurRecipes: boolean;
    limits: {
      maxUploadsPerDay: number;
      concurrentSessions: number;
      maxListCreates: number;
    };
    allowListCreation: boolean;
    allowTemplateCards: boolean;
  };
  preferences: {
    defaultPeopleCount: number;
    autoScale: boolean;
    allowCardLock: boolean;
    locale: string | null;
    dietaryTags: string[];
    allergenFlags: string[];
  };
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
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
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
  return { client, user: data.user };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let client;
  let user;
  try {
    const auth = await getAuthedClient(req);
    client = auth.client;
    user = auth.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return jsonResponse({ error: message }, { status });
  }

  try {
    let { data: preferencesRecord } = await client
      .from("menu_user_preferences")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (req.method === "PATCH") {
      const body = (await req.json().catch(() => ({}))) as {
        locale?: string | null;
        dietaryTags?: string[];
        allergenFlags?: string[];
        defaultPeopleCount?: number;
        autoScale?: boolean;
        allowCardLock?: boolean;
      };
      const upsertPayload = {
        owner_id: user.id,
        locale: body.locale ?? preferencesRecord?.locale ?? null,
        dietary_tags: body.dietaryTags ?? preferencesRecord?.dietary_tags ?? [],
        allergen_flags: body.allergenFlags ?? preferencesRecord?.allergen_flags ?? [],
        default_people_count:
          body.defaultPeopleCount && body.defaultPeopleCount > 0
            ? body.defaultPeopleCount
            : preferencesRecord?.default_people_count ?? 1,
        auto_scale: body.autoScale ?? preferencesRecord?.auto_scale ?? true,
        allow_card_lock: body.allowCardLock ?? preferencesRecord?.allow_card_lock ?? true
      };
      const { error, data } = await client
        .from("menu_user_preferences")
        .upsert(upsertPayload, { onConflict: "owner_id" })
        .select("*")
        .single();
      if (error) {
        console.error("menu_user_preferences upsert failed", error);
        return jsonResponse({ error: "preferences_update_failed" }, { status: 400 });
      }
      preferencesRecord = data ?? upsertPayload;
    } else if (req.method !== "GET") {
      return jsonResponse({ error: "method_not_allowed" }, { status: 405 });
    }

    const preferences = preferencesRecord ?? null;

    const isPremium = Boolean(user.app_metadata?.is_menu_premium ?? false);
    const policy: PolicyResponse["policy"] = {
      isPremium,
      accessLevel: isPremium ? "full" : "title_only",
      blurRecipes: !isPremium,
      limits: isPremium
        ? { maxUploadsPerDay: 25, concurrentSessions: 5, maxListCreates: 25 }
        : { maxUploadsPerDay: 3, concurrentSessions: 1, maxListCreates: 1 },
      allowListCreation: isPremium,
      allowTemplateCards: true,
    };

    const prefs: PolicyResponse["preferences"] = {
      defaultPeopleCount: preferences?.default_people_count ?? 1,
      autoScale: preferences?.auto_scale ?? true,
      allowCardLock: preferences?.allow_card_lock ?? true,
      locale: preferences?.locale ?? (user.app_metadata?.locale ?? null),
      dietaryTags: preferences?.dietary_tags ?? [],
      allergenFlags: preferences?.allergen_flags ?? [],
    };

    return jsonResponse({ policy, preferences: prefs } satisfies PolicyResponse);
  } catch (error) {
    console.error("menus-policy failure", error);
    return jsonResponse({ error: "policy_load_failed" }, { status: 500 });
  }
});
