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

    // Require authenticated caller and verify userId matches their JWT sub.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (claimsData.claims.sub !== userId) {
      return new Response(JSON.stringify({ error: "userId does not match authenticated user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the invite + linked profile (token-only invite, person/company data on profile)
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("company_invites")
      .select("id, profile_id, profiles:profile_id(id, email, pending_role, company_id, invitation_status, full_name)")
      .eq("token", token)
      .maybeSingle();

    const invProfile = (invite as any)?.profiles;
    if (inviteErr || !invite || !invProfile || invProfile.invitation_status !== "invited") {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const companyId = invProfile.company_id;
    const inviteRole = invProfile.pending_role || "dispatcher";
    const inviteEmail = invProfile.email;

    // Check user doesn't already have a membership
    const { data: existing } = await supabaseAdmin
      .from("company_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (existing) {
      // Already a member: clean up token and pending profile placeholder.
      await supabaseAdmin.from("company_invites").delete().eq("id", invite.id);
      await supabaseAdmin.from("profiles").delete().eq("id", invProfile.id);

      return new Response(JSON.stringify({ ok: true, message: "Already a member" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company_membership
    const { error: membershipErr } = await supabaseAdmin
      .from("company_memberships")
      .insert({
        company_id: companyId,
        user_id: userId,
        role: inviteRole,
      });

    if (membershipErr) {
      console.error("Membership error:", membershipErr);
      return new Response(JSON.stringify({ error: "Failed to create membership" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Promote the placeholder profile in-place: attach user_id and flip to active.
    const { data: existingForUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingForUser) {
      // User already has a profile (rare): keep theirs, drop the placeholder.
      await supabaseAdmin
        .from("profiles")
        .update({
          company_id: companyId,
          active_company_id: companyId,
          invitation_status: "active",
          active: true,
        })
        .eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", invProfile.id);
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({
          user_id: userId,
          active_company_id: companyId,
          full_name: fullName || invProfile.full_name || (inviteEmail ? inviteEmail.split("@")[0] : "User"),
          invitation_status: "active",
          pending_role: null,
          active: true,
        })
        .eq("id", invProfile.id);
    }

    // Token-only invite row is consumed.
    await supabaseAdmin.from("company_invites").delete().eq("id", invite.id);

    console.log(`User ${userId} accepted invite to company ${companyId} as ${inviteRole}`);

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
