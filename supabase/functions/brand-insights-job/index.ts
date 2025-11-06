import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !serviceKey) {
  console.error("brand-insights-job: missing Supabase credentials");
}

const supabase = createClient(supabaseUrl ?? "", serviceKey ?? "", {
  auth: { persistSession: false },
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    ...init,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "supabase_credentials_missing" }, { status: 500 });
  }

  try {
    const started = Date.now();
    const { error } = await supabase.rpc('refresh_brand_price_insights');
    if (error) {
      console.error('brand-insights-job: refresh failed', error);
      return jsonResponse({ error: error.message, code: error.code ?? 'refresh_failed' }, { status: 500 });
    }

    const { count } = await supabase
      .from('brand_price_insights')
      .select('*', { count: 'exact', head: true });

    return jsonResponse({
      status: 'ok',
      durationMs: Date.now() - started,
      records: count ?? 0,
    });
  } catch (error) {
    console.error('brand-insights-job: unexpected error', error);
    return jsonResponse({ error: 'unexpected_error' }, { status: 500 });
  }
});
