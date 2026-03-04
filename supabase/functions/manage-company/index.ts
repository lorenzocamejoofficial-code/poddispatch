import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is system creator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sc } = await supabaseAdmin
      .from("system_creators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sc) {
      return new Response(JSON.stringify({ error: "Forbidden: System creator only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { companyId, action, reason } = await req.json();

    if (!companyId || !action) {
      return new Response(JSON.stringify({ error: "companyId and action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "active",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", companyId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_approved",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { approved_by: user.email },
      });

      return new Response(JSON.stringify({ success: true, status: "active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_reason: reason || "No reason provided",
        })
        .eq("id", companyId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_rejected",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason },
      });

      return new Response(JSON.stringify({ success: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Fetch company to verify it's pending
      const { data: company, error: fetchErr } = await supabaseAdmin
        .from("companies")
        .select("id, onboarding_status, owner_user_id")
        .eq("id", companyId)
        .maybeSingle();

      if (fetchErr || !company) {
        return new Response(JSON.stringify({ error: "Company not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (company.onboarding_status !== "pending_approval" && company.onboarding_status !== "rejected") {
        return new Response(
          JSON.stringify({ error: "Only pending or rejected companies can be deleted" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cid = companyId;

      // Delete in safe order — child tables first
      // Operational data scoped to company_id
      await supabaseAdmin.from("hold_timers").delete().eq("company_id", cid);
      await supabaseAdmin.from("comms_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("trip_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("daily_truck_metrics").delete().eq("company_id", cid);
      await supabaseAdmin.from("truck_risk_state").delete().eq("company_id", cid);
      await supabaseAdmin.from("operational_alerts").delete().eq("company_id", cid);
      await supabaseAdmin.from("safety_overrides").delete().eq("company_id", cid);
      await supabaseAdmin.from("billing_overrides").delete().match({});  // no company_id col, skip
      await supabaseAdmin.from("claim_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("trip_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("qa_reviews").delete().eq("company_id", cid);
      await supabaseAdmin.from("crews").delete().eq("company_id", cid);
      await supabaseAdmin.from("alerts").delete().eq("company_id", cid);
      await supabaseAdmin.from("runs").delete().eq("company_id", cid);
      await supabaseAdmin.from("scheduling_legs").delete().eq("company_id", cid);
      await supabaseAdmin.from("facilities").delete().eq("company_id", cid);
      await supabaseAdmin.from("patients").delete().eq("company_id", cid);
      await supabaseAdmin.from("trucks").delete().eq("company_id", cid);
      await supabaseAdmin.from("charge_master").delete().eq("company_id", cid);
      await supabaseAdmin.from("payer_billing_rules").delete().eq("company_id", cid);
      await supabaseAdmin.from("import_sessions").delete().eq("company_id", cid);
      await supabaseAdmin.from("import_mapping_templates").delete().eq("company_id", cid);
      await supabaseAdmin.from("migration_settings").delete().eq("company_id", cid);
      await supabaseAdmin.from("truck_availability").delete().eq("company_id", cid);

      // Company admin records
      await supabaseAdmin.from("legal_acceptances").delete().eq("company_id", cid);
      await supabaseAdmin.from("onboarding_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("subscription_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_invites").delete().eq("company_id", cid);

      // Profiles and memberships
      await supabaseAdmin.from("profiles").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_memberships").delete().eq("company_id", cid);

      // Finally delete the company
      const { error: delErr } = await supabaseAdmin.from("companies").delete().eq("id", cid);
      if (delErr) {
        console.error("Company delete error:", delErr);
        return new Response(JSON.stringify({ error: "Failed to delete company: " + delErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Optionally delete the auth user if they only belonged to this company
      if (company.owner_user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(company.owner_user_id);
        } catch (e) {
          console.warn("Could not delete auth user (may have other data):", e);
        }
      }

      await supabaseAdmin.from("audit_logs").insert({
        action: "company_deleted",
        actor_user_id: user.id,
        actor_email: user.email,
        record_id: cid,
        table_name: "companies",
        notes: reason || "Pending company deleted by system creator",
      });

      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-company error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
