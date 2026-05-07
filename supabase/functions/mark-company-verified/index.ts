import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // Parse + validate body
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const companyId = body?.company_id;
    if (typeof companyId !== "string" || !UUID_RE.test(companyId)) {
      return json({ error: "company_id must be a valid uuid" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // System creator gate
    const { data: sc, error: scErr } = await admin
      .from("system_creators")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (scErr) return json({ error: scErr.message }, 500);
    if (!sc) return json({ error: "Forbidden — system creators only" }, 403);

    // Update verified_by
    const { error: updErr } = await admin
      .from("companies")
      .update({ verified_by: userId })
      .eq("id", companyId);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({ ok: true });
  } catch (err: any) {
    return json({ error: err?.message || "Internal error" }, 500);
  }
});