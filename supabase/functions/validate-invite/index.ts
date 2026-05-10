import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Token-only invite row joined to its profile (which holds person/company data)
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("company_invites")
      .select("id, profile_id, profiles:profile_id(email, pending_role, company_id, invitation_status)")
      .eq("token", token)
      .maybeSingle();

    const profile = (invite as any)?.profiles;
    if (inviteErr || !invite || !profile || profile.invitation_status !== "invited") {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch company name
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        invite: {
          id: invite.id,
          email: profile.email,
          role: profile.pending_role,
          company_id: profile.company_id,
          company_name: company?.name ?? "Unknown Company",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validate invite error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
