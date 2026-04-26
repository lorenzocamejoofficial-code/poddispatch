import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const sftp_password: string | undefined = body?.sftp_password;

    if (!sftp_password || typeof sftp_password !== "string" || sftp_password.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Password is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (sftp_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Validate the JWT and resolve the caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const user = userRes.user;

    // 2. Resolve company + role via service-role (avoid relying on RLS)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: membership, error: memErr } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (memErr || !membership) {
      return new Response(
        JSON.stringify({ error: "No company membership found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!["owner", "creator"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Only owners can save clearinghouse credentials" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const company_id = membership.company_id;

    // 3. Upsert the credentials row (server-only RLS table)
    const { error: upsertErr } = await admin
      .from("clearinghouse_credentials")
      .upsert(
        { company_id, sftp_password, updated_at: new Date().toISOString() },
        { onConflict: "company_id" }
      );

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: `Failed to save credentials: ${upsertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Audit log — never include the password
    await admin.from("admin_actions").insert({
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "clearinghouse_credentials_saved",
      company_id,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
