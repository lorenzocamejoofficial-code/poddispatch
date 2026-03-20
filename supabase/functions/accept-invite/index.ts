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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, userId, fullName } = await req.json();

    if (!token || !userId) {
      return new Response(JSON.stringify({ error: "Token and userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate that userId matches the authenticated caller (if auth header present)
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(
        authHeader.replace("Bearer ", "")
      );
      if (!claimsErr && claimsData?.claims?.sub && claimsData.claims.sub !== userId) {
        return new Response(JSON.stringify({ error: "userId does not match authenticated user" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Look up the invite
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("company_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user doesn't already have a membership
    const { data: existing } = await supabaseAdmin
      .from("company_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", invite.company_id)
      .maybeSingle();

    if (existing) {
      // Already a member, just mark invite accepted
      await supabaseAdmin
        .from("company_invites")
        .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      return new Response(JSON.stringify({ ok: true, message: "Already a member" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company_membership
    const { error: membershipErr } = await supabaseAdmin
      .from("company_memberships")
      .insert({
        company_id: invite.company_id,
        user_id: userId,
        role: invite.role,
      });

    if (membershipErr) {
      console.error("Membership error:", membershipErr);
      return new Response(JSON.stringify({ error: "Failed to create membership" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create profile if it doesn't exist
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        user_id: userId,
        full_name: fullName || invite.email.split("@")[0],
        company_id: invite.company_id,
      });
    }

    // Mark invite as accepted
    await supabaseAdmin
      .from("company_invites")
      .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    console.log(`User ${userId} accepted invite to company ${invite.company_id} as ${invite.role}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Accept invite error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
