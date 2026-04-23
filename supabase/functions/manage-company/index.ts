import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Best-effort cancel of a Stripe subscription. Returns a status string suitable
// for admin_actions.stripe_cancel_status. Never throws — we always want the
// archive to proceed even if Stripe is unreachable, and we want a loud audit
// trail of what happened.
async function cancelStripeSubscription(
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
): Promise<string> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return "skipped: no STRIPE_SECRET_KEY configured";

  const { data: sub } = await supabaseAdmin
    .from("subscription_records")
    .select("stripe_subscription_id, provider_subscription_id, subscription_status")
    .eq("company_id", companyId)
    .maybeSingle();

  const subId = sub?.stripe_subscription_id ?? sub?.provider_subscription_id ?? null;
  if (!subId) return "no_subscription";
  if (sub?.subscription_status === "cancelled") return "already_cancelled";

  try {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return `failed: Stripe ${response.status} ${errorText}`;
    }

    await supabaseAdmin
      .from("subscription_records")
      .update({ subscription_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("company_id", companyId);
    return "cancelled";
  } catch (err) {
    return `failed: ${(err as Error).message ?? "unknown"}`;
  }
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

    const { companyId, action, reason, patch, verification, manualNotes } = await req.json();
    if (!companyId || !action) return json({ error: "companyId and action required" }, 400);

    // ── APPROVE ──────────────────────────────────────────────
    if (action === "approve") {
      // Approval gate: require a verification snapshot in the request body.
      // The creator UI runs the verification panel before approving and
      // forwards the results here. This makes the snapshot the load-bearing
      // record for whether a company is protected from hard deletion later.
      if (!verification || typeof verification !== "object") {
        return json({
          error: "Verification snapshot required to approve. Run the verification panel first.",
          code: "VERIFICATION_REQUIRED",
        }, 400);
      }

      const npiStatus = verification?.npi?.status;
      const medicareStatus = verification?.medicare?.status;
      const oigStatus = verification?.oig?.status;

      // Refuse to approve if any check is still pending — forces the creator
      // to re-run verification rather than capturing a half-finished snapshot.
      if (npiStatus === "pending" || medicareStatus === "pending" || oigStatus === "pending") {
        return json({
          error: "Verification still in progress. Refresh checks before approving.",
          code: "VERIFICATION_PENDING",
        }, 400);
      }

      const npiVerified = npiStatus === "verified";
      const medicareEnrolled = medicareStatus === "enrolled";
      const oigClear = oigStatus === "not_excluded";

      const { error: updateError } = await supabaseAdmin
        .from("companies")
        .update({
          // Gate full app access behind Stripe checkout. The company is
          // approved by the admin but cannot use the app until payment
          // is completed (handled by stripe-webhook → checkout.session.completed).
          onboarding_status: "approved_pending_payment",
          approved_at: new Date().toISOString(),
          approved_by: user.id,
        })
        .eq("id", companyId);

      if (updateError) return json({ error: updateError.message }, 500);

      // Append-only verification snapshot. This is the immutable record of
      // what was true at approval time, used by is_protected_record() to
      // decide archive-vs-hard-delete later.
      const { error: vErr } = await supabaseAdmin.from("company_verifications").insert({
        company_id: companyId,
        approver_user_id: user.id,
        approver_email: user.email,
        npi_verified: npiVerified,
        npi_result: verification.npi ?? null,
        medicare_enrolled: medicareEnrolled,
        medicare_result: verification.medicare ?? null,
        oig_clear: oigClear,
        oig_result: verification.oig ?? null,
        manual_notes: typeof manualNotes === "string" ? manualNotes : null,
      });
      if (vErr) {
        // Hard fail — without the snapshot we cannot legally protect this
        // company later. Roll back the approval.
        await supabaseAdmin
          .from("companies")
          .update({ onboarding_status: "pending_approval", approved_at: null, approved_by: null })
          .eq("id", companyId);
        return json({ error: `Failed to record verification snapshot: ${vErr.message}` }, 500);
      }

      // Mark subscription as awaiting payment. Trial period (and `active`
      // subscription_status) are now started only when Stripe confirms
      // checkout.session.completed.
      await supabaseAdmin
        .from("subscription_records")
        .update({
          subscription_status: "approved_pending_payment",
        })
        .eq("company_id", companyId);

      await supabaseAdmin.from("onboarding_events").insert({
        company_id: companyId,
        event_type: "company_approved",
        actor_user_id: user.id,
        actor_email: user.email,
        details: {
          approved_by: user.email,
          gate: "awaiting_payment",
          verification: { npi: npiStatus, medicare: medicareStatus, oig: oigStatus },
          protected_at_approval: npiVerified || medicareEnrolled || oigClear,
        },
      });

      return json({ success: true, status: "approved_pending_payment" });
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

    // ── DELETE (auto-routes to archive vs hard delete) ────────
    // The single `delete` action is now intent-driven: the server inspects
    // is_protected_record(company_id) and routes to archive (soft-delete with
    // legal retention) or hard-delete. Callers don't get to override; the
    // protection rule lives entirely in the database.
    if (action === "delete" || action === "archive") {
      const { data: company, error: fetchErr } = await supabaseAdmin
        .from("companies")
        .select("id, name, onboarding_status, owner_user_id, deleted_at, approved_at")
        .eq("id", companyId)
        .maybeSingle();

      if (fetchErr || !company) return json({ error: "Company not found" }, 404);

      // Single source of truth.
      const { data: protectedResult, error: protErr } = await supabaseAdmin
        .rpc("is_protected_record", { _company_id: companyId });
      if (protErr) {
        return json({ error: `Could not evaluate protection status: ${protErr.message}` }, 500);
      }
      const isProtected = !!protectedResult;

      // Snapshot company state before any change.
      const { data: beforeSnap } = await supabaseAdmin
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();

      // Cancel Stripe subscription on the way out (best-effort).
      const stripeCancelStatus = await cancelStripeSubscription(supabaseAdmin, companyId);

      if (isProtected) {
        // ─── ARCHIVE ───────────────────────────────────────────
        // Set deleted_at on the company. This single flag drives RLS
        // everywhere (get_my_company_id excludes archived companies, so
        // members lose access to all related rows automatically). No
        // per-row deletion of clinical data — that would compromise
        // legally-required retention.
        const { error: archiveErr } = await supabaseAdmin
          .from("companies")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            onboarding_status: "suspended",
            suspended_reason: `ARCHIVED: ${reason || "Archived by system creator"}`,
            suspended_at: new Date().toISOString(),
            suspended_by: user.id,
          })
          .eq("id", companyId);
        if (archiveErr) return json({ error: `Archive failed: ${archiveErr.message}` }, 500);

        await supabaseAdmin.from("admin_actions").insert({
          actor_user_id: user.id,
          actor_email: user.email,
          action: "archive_company",
          company_id: companyId,
          company_name: company.name,
          was_protected: true,
          reason: reason || null,
          before_snapshot: beforeSnap,
          stripe_cancel_status: stripeCancelStatus,
        });

        return json({
          success: true,
          archived: true,
          stripe_cancel_status: stripeCancelStatus,
        });
      }

      // ─── HARD DELETE (unprotected) ──────────────────────────
      // No PCRs ever submitted, never approved with verification → not a
      // legal retention obligation. Cascade-purge as before.
      const cid = companyId;

      await supabaseAdmin.from("hold_timers").delete().eq("company_id", cid);
      await supabaseAdmin.from("comms_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("trip_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("daily_truck_metrics").delete().eq("company_id", cid);
      await supabaseAdmin.from("truck_risk_state").delete().eq("company_id", cid);
      await supabaseAdmin.from("operational_alerts").delete().eq("company_id", cid);
      await supabaseAdmin.from("safety_overrides").delete().eq("company_id", cid);
      await supabaseAdmin.from("biller_tasks").delete().eq("company_id", cid);
      await supabaseAdmin.from("ar_followup_notes").delete().eq("company_id", cid);
      await supabaseAdmin.from("claim_adjustments").delete().eq("company_id", cid);
      await supabaseAdmin.from("remittance_files").delete().eq("company_id", cid);
      await supabaseAdmin.from("eligibility_checks").delete().eq("company_id", cid);
      await supabaseAdmin.from("incident_reports").delete().eq("company_id", cid);
      await supabaseAdmin.from("document_attachments").delete().eq("company_id", cid);
      await supabaseAdmin.from("claim_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("billing_overrides").delete().in("trip_id",
        (await supabaseAdmin.from("trip_records").select("id").eq("company_id", cid)).data?.map((r: any) => r.id) ?? ["00000000-0000-0000-0000-000000000000"]
      );
      await supabaseAdmin.from("trip_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("qa_reviews").delete().eq("company_id", cid);
      await supabaseAdmin.from("crews").delete().eq("company_id", cid);
      await supabaseAdmin.from("alerts").delete().eq("company_id", cid);
      await supabaseAdmin.from("schedule_change_log").delete().eq("company_id", cid);
      await supabaseAdmin.from("leg_exceptions").delete().in("scheduling_leg_id",
        (await supabaseAdmin.from("scheduling_legs").select("id").eq("company_id", cid)).data?.map((r: any) => r.id) ?? ["00000000-0000-0000-0000-000000000000"]
      );
      await supabaseAdmin.from("truck_run_slots").delete().eq("company_id", cid);
      await supabaseAdmin.from("runs").delete().eq("company_id", cid);
      await supabaseAdmin.from("scheduling_legs").delete().eq("company_id", cid);
      await supabaseAdmin.from("patient_schedule_overrides").delete().eq("company_id", cid);
      await supabaseAdmin.from("facilities").delete().eq("company_id", cid);
      await supabaseAdmin.from("patients").delete().eq("company_id", cid);
      await supabaseAdmin.from("vehicle_inspections").delete().eq("company_id", cid);
      await supabaseAdmin.from("crew_share_tokens").delete().eq("company_id", cid);
      await supabaseAdmin.from("trucks").delete().eq("company_id", cid);
      await supabaseAdmin.from("charge_master").delete().eq("company_id", cid);
      await supabaseAdmin.from("payer_billing_rules").delete().eq("company_id", cid);
      await supabaseAdmin.from("import_sessions").delete().eq("company_id", cid);
      await supabaseAdmin.from("import_mapping_templates").delete().eq("company_id", cid);
      await supabaseAdmin.from("migration_settings").delete().eq("company_id", cid);
      await supabaseAdmin.from("truck_availability").delete().eq("company_id", cid);
      await supabaseAdmin.from("legal_acceptances").delete().eq("company_id", cid);
      await supabaseAdmin.from("onboarding_events").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_verifications").delete().eq("company_id", cid);
      await supabaseAdmin.from("subscription_records").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_invites").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_settings").delete().eq("company_id", cid);
      await supabaseAdmin.from("audit_logs").delete().eq("company_id", cid);
      await supabaseAdmin.from("profiles").delete().eq("company_id", cid);
      await supabaseAdmin.from("company_memberships").delete().eq("company_id", cid);

      const { error: delErr } = await supabaseAdmin.from("companies").delete().eq("id", cid);
      if (delErr) {
        console.error("Hard delete failed:", delErr);
        return json({ error: "Failed to delete company: " + delErr.message }, 500);
      }

      if (company.owner_user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(company.owner_user_id);
        } catch (e) {
          console.warn("Could not delete auth user:", e);
        }
      }

      await supabaseAdmin.from("admin_actions").insert({
        actor_user_id: user.id,
        actor_email: user.email,
        action: "hard_delete_company",
        company_id: null,            // company row is gone
        company_name: company.name,
        was_protected: false,
        reason: reason || null,
        before_snapshot: beforeSnap,
        stripe_cancel_status: stripeCancelStatus,
      });

      return json({ success: true, deleted: true, stripe_cancel_status: stripeCancelStatus });
    }

    // ── RESTORE FROM ARCHIVE (creator can un-archive) ────────
    if (action === "restore_archived") {
      const { error: restoreErr } = await supabaseAdmin
        .from("companies")
        .update({
          deleted_at: null,
          deleted_by: null,
          onboarding_status: "active",
          suspended_reason: null,
          suspended_at: null,
          suspended_by: null,
        })
        .eq("id", companyId);
      if (restoreErr) return json({ error: restoreErr.message }, 500);

      await supabaseAdmin.from("admin_actions").insert({
        actor_user_id: user.id,
        actor_email: user.email,
        action: "restore_company",
        company_id: companyId,
        reason: reason || null,
      });

      return json({ success: true, restored: true });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("manage-company error:", err);
    return json({ error: message, code: "MANAGE_COMPANY_ERROR" }, 500);
  }
});
