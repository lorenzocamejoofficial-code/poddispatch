import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: sc } = await supabaseAdmin
      .from("system_creators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!sc) return json({ error: "Forbidden: System creator only" }, 403);

    const { companyId, action, reason, patch } = await req.json();
    if (!companyId || !action) return json({ error: "companyId and action required" }, 400);

    // ── APPROVE ──────────────────────────────────────────────
    if (action === "approve") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "active",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_approved",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { approved_by: user.email },
      });

      return json({ success: true, status: "active" });
    }

    // ── REJECT ───────────────────────────────────────────────
    if (action === "reject") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "rejected",
          rejected_at: new Date().toISOString(),
          rejected_reason: reason || "No reason provided",
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_rejected",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason },
      });

      return json({ success: true, status: "rejected" });
    }

    // ── SUSPEND ──────────────────────────────────────────────
    if (action === "suspend") {
      if (!reason) return json({ error: "Suspension reason required" }, 400);

      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "suspended",
          suspended_reason: reason,
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_suspended",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason },
      });

      return json({ success: true, status: "suspended" });
    }

    // ── UNSUSPEND ────────────────────────────────────────────
    if (action === "unsuspend") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "active",
          suspended_reason: null,
          suspended_at: null,
          suspended_by: null,
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_unsuspended",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason: reason || "Reactivated by system creator" },
      });

      return json({ success: true, status: "active" });
    }

    // ── FORCE PASSWORD RESET ─────────────────────────────────
    if (action === "force_password_reset") {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("owner_user_id, owner_email")
        .eq("id", companyId)
        .maybeSingle();

      if (!company?.owner_user_id) return json({ error: "Owner not found" }, 404);

      // Get the owner's email from auth
      const { data: ownerAuth } = await supabaseAdmin.auth.admin.getUserById(company.owner_user_id);
      const ownerEmail = ownerAuth?.user?.email || company.owner_email;
      if (!ownerEmail) return json({ error: "Owner email not found" }, 404);

      // Generate a password reset link
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: ownerEmail,
      });

      if (linkErr) return json({ error: linkErr.message }, 500);

      await supabaseAdmin.from("audit_logs").insert({
        action: "force_password_reset",
        actor_user_id: user.id,
        actor_email: user.email,
        record_id: companyId,
        table_name: "companies",
        notes: `Password reset triggered for ${ownerEmail}`,
      });

      return json({
        success: true,
        message: `Password reset email sent to ${ownerEmail}`,
      });
    }

    // ── UPDATE COMPANY PROFILE ───────────────────────────────
    if (action === "update_profile") {
      if (!patch || typeof patch !== "object") return json({ error: "patch object required" }, 400);

      // Only allow safe fields
      const allowedFields = ["name"];
      const safePatch: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in patch) safePatch[key] = patch[key];
      }

      if (Object.keys(safePatch).length === 0) return json({ error: "No valid fields to update" }, 400);

      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update(safePatch)
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("audit_logs").insert({
        action: "company_profile_updated",
        actor_user_id: user.id,
        actor_email: user.email,
        record_id: companyId,
        table_name: "companies",
        new_data: safePatch,
      });

      return json({ success: true });
    }

    // ── SOFT DELETE (for active companies) ─────────────────────
    if (action === "soft_delete") {
      if (!reason) return json({ error: "Deletion reason required" }, 400);

      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id, onboarding_status")
        .eq("id", companyId)
        .maybeSingle();

      if (!company) return json({ error: "Company not found" }, 404);

      // Mark as soft-deleted — hide from login and active lists
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "suspended",
          suspended_reason: `SOFT_DELETED: ${reason}`,
          suspended_at: new Date().toISOString(),
          suspended_by: user.id,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_soft_deleted",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason },
      });

      await supabaseAdmin.from("audit_logs").insert({
        action: "company_soft_deleted",
        actor_user_id: user.id,
        actor_email: user.email,
        record_id: companyId,
        table_name: "companies",
        notes: `Soft-deleted: ${reason}. Recovery window: 30 days.`,
      });

      return json({ success: true, status: "soft_deleted" });
    }

    // ── RESTORE (undo soft delete) ───────────────────────────
    if (action === "restore") {
      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          onboarding_status: "active",
          suspended_reason: null,
          suspended_at: null,
          suspended_by: null,
          deleted_at: null,
          deleted_by: null,
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_restored",
        actor_user_id: user.id,
        actor_email: user.email,
        details: { reason: reason || "Restored by system creator" },
      });

      return json({ success: true, status: "active" });
    }

    // ── DELETE (hard delete — pending/rejected/soft-deleted) ──
    if (action === "delete") {
      const { data: company, error: fetchErr } = await supabaseAdmin
        .from("companies")
        .select("id, onboarding_status, owner_user_id, deleted_at")
        .eq("id", companyId)
        .maybeSingle();

      if (fetchErr || !company) return json({ error: "Company not found" }, 404);

      const allowedStatuses = ["pending_approval", "rejected"];
      const isSoftDeleted = !!company.deleted_at;

      if (!allowedStatuses.includes(company.onboarding_status) && !isSoftDeleted) {
        return json({ error: "Only pending, rejected, or soft-deleted companies can be permanently deleted. Use soft_delete first for active companies." }, 400);
      }

      const cid = companyId;

      // Delete in safe order — child tables first
      await supabaseAdmin.from("hold_timers").delete().eq("company_id", cid);
      await supabaseAdmin.from("comms_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("trip_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("daily_truck_metrics").delete().eq("company_id", cid);
      await supabaseAdmin.from("truck_risk_state").delete().eq("company_id", cid);
      await supabaseAdmin.from("operational_alerts").delete().eq("company_id", cid);
      await supabaseAdmin.from("safety_overrides").delete().eq("company_id", cid);
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
      await supabaseAdmin.from("legal_acceptances").delete().eq("company_id", cid);
      await supabaseAdmin.from("onboarding_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("subscription_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_invites").delete().eq("company_id", cid);
      await supabaseAdmin.from("profiles").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_memberships").delete().eq("company_id", cid);

      const { error: delErr } = await supabaseAdmin.from("companies").delete().eq("id", cid);
      if (delErr) return json({ error: "Failed to delete company: " + delErr.message }, 500);

      if (company.owner_user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(company.owner_user_id);
        } catch (e) {
          console.warn("Could not delete auth user:", e);
        }
      }

      await supabaseAdmin.from("audit_logs").insert({
        action: "company_deleted",
        actor_user_id: user.id,
        actor_email: user.email,
        record_id: cid,
        table_name: "companies",
        notes: reason || "Company permanently deleted by system creator",
      });

      return json({ success: true, deleted: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    console.error("manage-company error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
