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

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: callerUser } = await callerClient.auth.getUser();
    if (!callerUser?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = callerUser.user.id;
    const userEmail = callerUser.user.email;

    // Check user doesn't already belong to a company
    const { data: existingMembership } = await supabaseAdmin
      .from("company_memberships")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMembership) {
      return new Response(JSON.stringify({ error: "You already belong to a company" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { companyName, fullName } = await req.json();

    if (!companyName?.trim()) {
      return new Response(JSON.stringify({ error: "Company name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create company
    const { data: company, error: companyErr } = await supabaseAdmin
      .from("companies")
      .insert({
        name: companyName.trim(),
        onboarding_status: "active",
        owner_user_id: userId,
        owner_email: userEmail,
      })
      .select("id")
      .single();

    if (companyErr) {
      console.error("Company creation error:", companyErr);
      return new Response(JSON.stringify({ error: "Failed to create company" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = company.id;

    // Create membership with owner role
    await supabaseAdmin.from("company_memberships").insert({
      company_id: companyId,
      user_id: userId,
      role: "owner",
    });

    // Create profile
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        user_id: userId,
        full_name: (fullName || userEmail?.split("@")[0] || "Owner").trim(),
        company_id: companyId,
      });
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({ company_id: companyId })
        .eq("user_id", userId);
    }

    // Create company_settings
    await supabaseAdmin
      .from("company_settings")
      .insert({ company_name: companyName.trim() });

    console.log(`Company ${companyName} created by ${userEmail} (${userId})`);

    return new Response(JSON.stringify({ ok: true, companyId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Create company error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
