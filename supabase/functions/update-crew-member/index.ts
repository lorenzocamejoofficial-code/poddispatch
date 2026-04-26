import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing auth" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const actor = userData.user;

    const body = await req.json().catch(() => ({}));
    const {
      target_user_id,
      email,
      phone_number,
      full_name,
      sex,
      cert_level,
      employment_type,
      max_safe_team_lift_lbs,
      stair_chair_trained,
      bariatric_trained,
      oxygen_handling_trained,
      lift_assist_ok,
      role,
    } = body ?? {};

    if (!target_user_id || typeof target_user_id !== "string") {
      return json({ error: "target_user_id required" }, 400);
    }
    if (email !== undefined && (typeof email !== "string" || !EMAIL_REGEX.test(email.trim().toLowerCase()))) {
      return json({ error: "Invalid email" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Caller must be owner/creator of a company
    const { data: actorMembership } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", actor.id)
      .maybeSingle();

    if (!actorMembership || !["owner", "creator"].includes(actorMembership.role as string)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Target must belong to same company
    const { data: targetMembership } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", target_user_id)
      .maybeSingle();

    if (!targetMembership || targetMembership.company_id !== actorMembership.company_id) {
      return json({ error: "Target not in your company" }, 403);
    }

    // Cannot modify another owner
    if (targetMembership.role === "owner" && target_user_id !== actor.id) {
      return json({ error: "Cannot modify another owner" }, 403);
    }

    // Update auth email if provided and changed
    if (email) {
      const newEmail = email.trim().toLowerCase();
      const { data: existing } = await admin.auth.admin.getUserById(target_user_id);
      if (existing?.user && existing.user.email !== newEmail) {
        const { error: emailErr } = await admin.auth.admin.updateUserById(target_user_id, {
          email: newEmail,
          email_confirm: true,
        });
        if (emailErr) return json({ error: "Email update failed: " + emailErr.message }, 400);
      }
    }

    // Update profile fields
    const profileUpdate: Record<string, unknown> = {};
    if (full_name !== undefined) profileUpdate.full_name = full_name;
    if (phone_number !== undefined) profileUpdate.phone_number = phone_number || null;
    if (sex !== undefined) profileUpdate.sex = sex;
    if (cert_level !== undefined) profileUpdate.cert_level = cert_level;
    if (employment_type !== undefined) profileUpdate.employment_type = employment_type;
    if (max_safe_team_lift_lbs !== undefined) profileUpdate.max_safe_team_lift_lbs = max_safe_team_lift_lbs;
    if (stair_chair_trained !== undefined) profileUpdate.stair_chair_trained = !!stair_chair_trained;
    if (bariatric_trained !== undefined) profileUpdate.bariatric_trained = !!bariatric_trained;
    if (oxygen_handling_trained !== undefined) profileUpdate.oxygen_handling_trained = !!oxygen_handling_trained;
    if (lift_assist_ok !== undefined) profileUpdate.lift_assist_ok = !!lift_assist_ok;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: pErr } = await admin
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", target_user_id)
        .eq("company_id", actorMembership.company_id);
      if (pErr) return json({ error: "Profile update failed: " + pErr.message }, 400);
    }

    // Update membership role (only for non-owner targets, and never elevate to owner)
    if (role && ["dispatcher", "biller", "crew"].includes(role) && targetMembership.role !== "owner") {
      await admin
        .from("company_memberships")
        .update({ role })
        .eq("user_id", target_user_id)
        .eq("company_id", actorMembership.company_id);
    }

    // Audit
    await admin.from("admin_actions").insert({
      company_id: actorMembership.company_id,
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      action: "crew_member_updated",
      before_snapshot: {
        target_user_id,
        fields: Object.keys(profileUpdate),
        email_changed: !!email,
        role_changed: !!role,
      },
    } as never);

    return json({ ok: true });
  } catch (e) {
    console.error("update-crew-member error", e);
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}