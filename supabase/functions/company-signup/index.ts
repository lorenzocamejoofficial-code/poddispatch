import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { seedChargeMasterForNewCompany } from "../_shared/seed-charge-master.ts";
import { sendViaResend } from "../_shared/send-via-resend.ts";

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
      email, password, fullName, companyName, phone, agreements,
      npiNumber, stateOfOperation, serviceAreaType, truckCount, payerMix,
      currentSoftware, yearsInOperation, hasInhouseBiller, hipaaPrivacyOfficer,
      einNumber, addressStreet, addressCity, addressZip,
    } = await req.json();

    // Derive caller IP from trusted request headers — never trust a body field.
    const realIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;

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

    // Address is required so we can derive Medicare locality / rural flag from ZIP.
    const zip5 = String(addressZip ?? "").replace(/\D/g, "").slice(0, 5);
    if (!addressStreet || !addressCity || zip5.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Business street address, city, and 5-digit ZIP are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate EIN — server-side, never trust client.
    // Accept "XX-XXXXXXX" or 9 raw digits. Strip the dash before storing.
    const einDigits = String(einNumber ?? "").replace(/\D/g, "");
    if (einDigits.length !== 9) {
      return new Response(
        JSON.stringify({ error: "EIN must be exactly 9 digits (format XX-XXXXXXX)" }),
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
        ein_number: einDigits,
        state_of_operation: stateOfOperation || null,
        service_area_type: serviceAreaType || "urban",
        address_street: String(addressStreet).trim(),
        address_city: String(addressCity).trim(),
        address_state: stateOfOperation || null,
        address_zip: zip5,
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
        agreement_version: "2.0", accepted_ip: realIp,
      });
    }

    // 7. Create subscription record (TEST_ACTIVE — payments disabled in build mode).
    // App-gated 30-day trial seeded here; Stripe sees no trial.
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from("subscription_records").insert({
      company_id: companyId, provider: "none",
      subscription_status: "TEST_ACTIVE", plan_id: "poddispatch_standard",
      trial_ends_at: trialEndsAt,
    });

    // 8. Create migration_settings for onboarding tracking
    await supabaseAdmin.from("migration_settings").insert({
      company_id: companyId, wizard_step: 0, wizard_completed: false,
    });

    // 8b. Auto-seed charge_master with real CMS 2026 Medicare rates for this ZIP.
    try {
      const seed = await seedChargeMasterForNewCompany(supabaseAdmin, companyId, zip5);
      if (!seed.ok) console.error("Charge master seed failed:", seed.error);
      else console.log(`Charge master seeded for ${companyId} (medicare=${seed.medicareSeeded}, rural=${seed.ruralFlag})`);
    } catch (seedErr) {
      console.error("Charge master seed threw:", seedErr);
    }

    // 9. Log onboarding event
    await supabaseAdmin.from("onboarding_events").insert({
      company_id: companyId, event_type: "signup_completed",
      actor_user_id: userId, actor_email: email,
      details: { company_name: companyName, plan: "standard", npi: npiNumber, state: stateOfOperation, service_area: serviceAreaType },
    });

    // 10. Notify system creators if "email_on_new_signup" is enabled.
    // No external email infrastructure is configured for this project, so we deliver the
    // notification as an in-app notification to every system creator account. This matches
    // the existing notifications-table pattern used elsewhere in the codebase.
    try {
      const { data: flag } = await supabaseAdmin
        .from("creator_settings")
        .select("value")
        .eq("key", "email_on_new_signup")
        .maybeSingle();
      if (flag?.value === "true") {
        const { data: creators } = await supabaseAdmin
          .from("system_creators")
          .select("user_id");
        const signupTs = new Date().toISOString();
        const message = `New company signup: ${companyName.trim()} (${email}) at ${signupTs}`;
        const rows = (creators ?? []).map((c: { user_id: string }) => ({
          user_id: c.user_id,
          notification_type: "new_company_signup",
          message,
          acknowledged: false,
        }));
        if (rows.length > 0) {
          await supabaseAdmin.from("notifications").insert(rows);
        }
      }
    } catch (notifyErr) {
      console.error("Creator signup notification failed:", notifyErr);
    }

    // 11. Send branded acknowledgment email to the applicant. Transactional
    // (one specific recipient, triggered by their signup action). Never blocks
    // signup completion if delivery fails.
    try {
      const safeCompany = String(companyName).trim().replace(/[<>]/g, "");
      const safeName = String(fullName).trim().replace(/[<>]/g, "");
      const logoUrl = "https://app.thepoddispatch.com/email-logo.png";
      const supportEmail = "support@thepoddispatch.com";
      const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr><td style="background:#1e3a5f;padding:24px 32px;" align="left">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;padding-right:12px;"><img src="${logoUrl}" width="36" height="36" alt="PodDispatch" style="display:block;border:0;"/></td>
              <td style="vertical-align:middle;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">PodDispatch</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;font-weight:700;">Thank you for signing up, ${safeName}.</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              We received your PodDispatch application for <strong style="color:#1e3a5f;">${safeCompany}</strong>. Your account is now under review by our team.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
              Reviews typically complete within one business day. You will receive a second email the moment your account is approved, along with a link to sign in and begin onboarding.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <tr><td style="padding:16px 20px;font-size:14px;color:#475569;line-height:1.6;">
                <strong style="color:#0f172a;">What happens next:</strong><br/>
                1. Our team verifies your NPI, EIN, and OIG exclusion status.<br/>
                2. We confirm your service area and Medicare locality.<br/>
                3. You receive an approval email with sign in instructions.
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#475569;">
              Questions in the meantime? Reply directly to this email, or contact us at
              <a href="mailto:${supportEmail}" style="color:#1e3a5f;font-weight:600;">${supportEmail}</a>.
            </p>
          </td></tr>
          <tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 32px;font-size:12px;color:#94a3b8;line-height:1.5;">
            This message was sent to ${email} because an application was submitted at thepoddispatch.com. If this was not you, please contact <a href="mailto:${supportEmail}" style="color:#64748b;">${supportEmail}</a> immediately.
          </td></tr>
        </table>
        <div style="font-size:11px;color:#94a3b8;padding-top:16px;">PodDispatch, Inc. &middot; noreply@thepoddispatch.com</div>
      </td></tr>
    </table>
  </body>
</html>`;
      const text = `Thank you for signing up, ${safeName}.\n\nWe received your PodDispatch application for ${safeCompany}. Your account is now under review.\n\nReviews typically complete within one business day. You will receive a second email the moment your account is approved.\n\nWhat happens next:\n1. We verify your NPI, EIN, and OIG exclusion status.\n2. We confirm your service area and Medicare locality.\n3. You receive an approval email with sign in instructions.\n\nQuestions? Reply to this email or contact ${supportEmail}.`;
      const sendResult = await sendViaResend({
        to: email,
        subject: `We received your PodDispatch application, ${safeName}`,
        html,
        text,
        reply_to: supportEmail,
        email_type: "other",
        company_id: companyId,
        recipient_user_id: userId,
      });
      if (!sendResult.ok) console.error("Applicant acknowledgment email failed:", sendResult.error);
    } catch (emailErr) {
      console.error("Applicant acknowledgment email threw:", emailErr);
    }

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
