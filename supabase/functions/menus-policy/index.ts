import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";
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

type PolicyResponse = {
  policy: {
    isPremium: boolean;
    accessLevel: "full" | "title_only";
    blurRecipes: boolean;
    limits: {
      maxUploadsPerDay: number;
      concurrentSessions: number;
      maxListCreates: number;
      remainingUploads: number;
      remainingListCreates: number;
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

const respond = (body: unknown, init: ResponseInit = {}, correlationId?: string) =>
  jsonResponse(body, init, corsHeaders, correlationId);

const respondError = (options: { code: string; correlationId: string; status?: number; details?: unknown }) =>
  errorResponse({ ...options, corsHeaders });

async function getUsage(client: any, userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from("menu_usage_counters")
    .select("uploads, list_creates")
    .eq("owner_id", userId)
    .eq("usage_date", today)
    .single();
  if (error && error.code !== "PGRST116") {
    console.error("menu_usage_counters fetch failed", error);
  }
  return { uploads: data?.uploads ?? 0, listCreates: data?.list_creates ?? 0 };
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

  const correlationId = getCorrelationId(req);

  let client;
  let user;
  try {
    const auth = await getAuthedClient(req);
    client = auth.client;
    user = auth.user;
  } catch (error) {
    const message = error instanceof Error ? error.message : "auth_error";
    const status = message === "auth_required" ? 401 : 500;
    return respondError({ code: message, correlationId, status });
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
        return respondError({ code: "preferences_update_failed", correlationId, status: 400 });
      }
      preferencesRecord = data ?? upsertPayload;
      logEvent({
        event: "menu_policy_updated",
        correlationId,
        ownerId: user.id,
        status: "preferences_saved"
      });
    } else if (req.method !== "GET") {
      return respondError({ code: "method_not_allowed", correlationId, status: 405 });
    }

    const preferences = preferencesRecord ?? null;

    const { data: premiumData, error: premiumError } = await client.rpc("menu_is_premium_user");
    if (premiumError) {
      console.error("menu_is_premium_user rpc failed", { correlationId, premiumError });
    }
    const isPremium = Boolean(premiumData) || Boolean(user.app_metadata?.is_menu_premium ?? false);
    const limitsBase = isPremium
      ? { maxUploadsPerDay: 10, concurrentSessions: 5, maxListCreates: 10 }
      : { maxUploadsPerDay: 3, concurrentSessions: 1, maxListCreates: 3 };
    const usage = await getUsage(client, user.id);
    const remainingUploads = Math.max(0, limitsBase.maxUploadsPerDay - usage.uploads);
    const remainingListCreates = Math.max(0, limitsBase.maxListCreates - usage.listCreates);
    const policy: PolicyResponse["policy"] = {
      isPremium,
      accessLevel: "full",
      blurRecipes: false,
      limits: {
        ...limitsBase,
        remainingUploads,
        remainingListCreates,
      },
      allowListCreation: remainingListCreates > 0,
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

    logEvent({
      event: "menu_policy_loaded",
      correlationId,
      ownerId: user.id,
      metadata: {
        isPremium,
        remainingUploads,
        remainingListCreates
      }
    });
    return respond(
      { policy, preferences: prefs, correlationId } satisfies PolicyResponse & { correlationId: string },
      {},
      correlationId
    );
  } catch (error) {
    console.error("menus-policy failure", error);
    return respondError({ code: "policy_load_failed", correlationId, status: 500 });
  }
});
