import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      email, password, fullName, companyName, phone, agreements, clientIp,
      npiNumber, stateOfOperation, serviceAreaType, truckCount, payerMix,
      currentSoftware, yearsInOperation, hasInhouseBiller, hipaaPrivacyOfficer,
    } = await req.json();

    if (!email || !password || !fullName || !companyName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!npiNumber || !stateOfOperation || !serviceAreaType) {
      return new Response(
        JSON.stringify({ error: "NPI number, state, and service area type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agreements?.terms_of_service || !agreements?.privacy_policy || !agreements?.hipaa_responsibilities) {
      return new Response(
        JSON.stringify({ error: "All legal agreements must be accepted" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
      });

    if (authError) {
      const msg = authError.message.toLowerCase();
      const isExisting = msg.includes("already") || msg.includes("exists") || msg.includes("registered");
      return new Response(
        JSON.stringify({
          error: isExisting
            ? "An account with this email already exists. Please sign in instead."
            : authError.message,
          code: isExisting ? "email_exists" : "auth_error",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // 2. Create company with pending_approval status + profile fields
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: companyName.trim(),
        onboarding_status: "pending_approval",
        owner_user_id: userId,
        owner_email: email,
        npi_number: npiNumber?.trim() || null,
        state_of_operation: stateOfOperation || null,
        service_area_type: serviceAreaType || "urban",
        payer_mix_medicare: payerMix?.medicare ?? 0,
        payer_mix_medicaid: payerMix?.medicaid ?? 0,
        payer_mix_facility: payerMix?.facility ?? 0,
        payer_mix_private: payerMix?.private ?? 0,
        truck_count: truckCount || 0,
        current_software: currentSoftware || null,
        years_in_operation: yearsInOperation || null,
        has_inhouse_biller: hasInhouseBiller || false,
        hipaa_privacy_officer: hipaaPrivacyOfficer || null,
      })
      .select("id")
      .single();

    if (companyError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to create company: " + companyError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = company.id;

    // 3. Create company_membership with role=owner
    const { error: membershipError } = await supabaseAdmin.from("company_memberships").insert({
      company_id: companyId, user_id: userId, role: "owner",
    });
    if (membershipError) console.error("Membership creation error:", membershipError);

    // 4. Create profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: userId, full_name: fullName.trim(), company_id: companyId, phone_number: phone || null,
    });
    if (profileError) console.error("Profile creation error:", profileError);

    // 5. Create company_settings
    const { error: settingsError } = await supabaseAdmin
      .from("company_settings")
      .insert({ company_name: companyName.trim(), company_id: companyId });
    if (settingsError) console.error("Settings creation error:", settingsError);

    // 6. Record legal acceptances
    const agreementTypes = ["terms_of_service", "privacy_policy", "hipaa_responsibilities"];
    for (const type of agreementTypes) {
      await supabaseAdmin.from("legal_acceptances").insert({
        company_id: companyId, user_id: userId, agreement_type: type,
        agreement_version: "2.0", accepted_ip: clientIp || null,
      });
    }

    // 7. Create subscription record (TEST_ACTIVE — payments disabled in build mode)
    await supabaseAdmin.from("subscription_records").insert({
      company_id: companyId, provider: "none",
      subscription_status: "TEST_ACTIVE", plan_id: "poddispatch_standard",
    });

    // 8. Create migration_settings for onboarding tracking
    await supabaseAdmin.from("migration_settings").insert({
      company_id: companyId, wizard_step: 0, wizard_completed: false,
    });

    // 9. Log onboarding event
    await supabaseAdmin.from("onboarding_events").insert({
      company_id: companyId, event_type: "signup_completed",
      actor_user_id: userId, actor_email: email,
      details: { company_name: companyName, plan: "standard", npi: npiNumber, state: stateOfOperation, service_area: serviceAreaType },
    });

    return new Response(
      JSON.stringify({ success: true, companyId, userId, status: "pending_approval" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
