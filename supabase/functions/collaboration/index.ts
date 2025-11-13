import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !anonKey) {
  console.error("collaboration function missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    ...init,
  });
}

type InvitePayload = {
  action: "generate" | "accept" | "revoke";
  listId?: string;
  role?: "editor" | "checker" | "observer";
  expiresInHours?: number;
  singleUse?: boolean;
  token?: string;
  inviteId?: string;
};

function intervalFromHours(hours?: number) {
  if (!hours || hours <= 0) {
    return null;
  }
  return `${hours} hours`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "supabase_not_configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return jsonResponse({ error: "auth_required" }, { status: 401 });
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  try {
    const payload = (await req.json()) as InvitePayload;
    switch (payload.action) {
      case "generate": {
        if (!payload.listId || !payload.role) {
          return jsonResponse({ error: "missing_params" }, { status: 400 });
        }
        const { data, error } = await client.rpc("generate_list_invite", {
          _list_id: payload.listId,
          _role: payload.role,
          _expires_in: intervalFromHours(payload.expiresInHours) ?? undefined,
          _single_use: payload.singleUse ?? false,
        });
        if (error) {
          return jsonResponse({ error: error.message }, { status: 400 });
        }
        return jsonResponse({ invite: data });
      }
      case "accept": {
        if (!payload.token) {
          return jsonResponse({ error: "missing_token" }, { status: 400 });
        }
        const { data, error } = await client.rpc("accept_list_invite", { _token: payload.token });
        if (error) {
          return jsonResponse({ error: error.message }, { status: 400 });
        }
        return jsonResponse({ membership: data });
      }
      case "revoke": {
        if (!payload.inviteId) {
          return jsonResponse({ error: "missing_invite" }, { status: 400 });
        }
        const { data, error } = await client.rpc("revoke_list_invite", { _invite_id: payload.inviteId });
        if (error) {
          return jsonResponse({ error: error.message }, { status: 400 });
        }
        return jsonResponse({ invite: data });
      }
      default:
        return jsonResponse({ error: "unsupported_action" }, { status: 400 });
    }
  } catch (error) {
    console.error("collaboration function failure", error);
    return jsonResponse({ error: "invalid_request" }, { status: 400 });
  }
});
