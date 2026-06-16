import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: authData, error: authErr } = await caller.auth.getUser();
    const user = authData?.user;
    const email = user?.email?.trim().toLowerCase();
    if (authErr || !user || !email) return json({ error: "Invalid session" }, 401);

    const { data: invitedProfiles, error: inviteErr } = await admin
      .from("profiles")
      .select("id, company_id, email, full_name, pending_role, sex, cert_level, phone_number, employment_type, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok, max_safe_team_lift_lbs, created_at")
      .is("user_id", null)
      .ilike("email", email)
      .in("invitation_status", ["invited", "pending_invite"])
      .order("created_at", { ascending: false });

    if (inviteErr) {
      console.error("claim-employee-invites lookup error", inviteErr);
      return json({ error: "Failed to check employee invites" }, 500);
    }

    if (!invitedProfiles?.length) return json({ ok: true, claimed: 0 });

    const companyIds = [...new Set(invitedProfiles.map((p: any) => p.company_id).filter(Boolean))];
    const { data: companies } = await admin
      .from("companies")
      .select("id, deleted_at")
      .in("id", companyIds);
    const liveCompanyIds = new Set((companies ?? []).filter((c: any) => !c.deleted_at).map((c: any) => c.id));
    const validInvites = invitedProfiles.filter((p: any) => p.company_id && liveCompanyIds.has(p.company_id));

    if (!validInvites.length) return json({ ok: true, claimed: 0 });

    const preferredInvite =
      validInvites.find((p: any) => (p.pending_role ?? "crew") === "crew") ?? validInvites[0];

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    for (const invite of validInvites) {
      const role = invite.pending_role || "crew";
      const { error: membershipErr } = await admin
        .from("company_memberships")
        .upsert(
          { company_id: invite.company_id, user_id: user.id, role },
          { onConflict: "company_id,user_id" },
        );
      if (membershipErr) {
        console.error("claim-employee-invites membership error", membershipErr);
        return json({ error: "Failed to activate employee membership" }, 500);
      }
    }

    const profilePatch = {
      company_id: preferredInvite.company_id,
      active_company_id: preferredInvite.company_id,
      email,
      full_name: preferredInvite.full_name || user.user_metadata?.full_name || email.split("@")[0],
      sex: preferredInvite.sex,
      cert_level: preferredInvite.cert_level,
      phone_number: preferredInvite.phone_number,
      employment_type: preferredInvite.employment_type,
      stair_chair_trained: preferredInvite.stair_chair_trained,
      bariatric_trained: preferredInvite.bariatric_trained,
      oxygen_handling_trained: preferredInvite.oxygen_handling_trained,
      lift_assist_ok: preferredInvite.lift_assist_ok,
      max_safe_team_lift_lbs: preferredInvite.max_safe_team_lift_lbs,
      invitation_status: "active",
      pending_role: null,
      active: true,
    };

    if (existingProfile) {
      const { error: updateErr } = await admin
        .from("profiles")
        .update(profilePatch as any)
        .eq("id", existingProfile.id);
      if (updateErr) {
        console.error("claim-employee-invites profile update error", updateErr);
        return json({ error: "Failed to activate employee profile" }, 500);
      }
      await admin.from("profiles").delete().in("id", validInvites.map((p: any) => p.id));
    } else {
      const { error: promoteErr } = await admin
        .from("profiles")
        .update({ ...profilePatch, user_id: user.id } as any)
        .eq("id", preferredInvite.id);
      if (promoteErr) {
        console.error("claim-employee-invites profile promote error", promoteErr);
        return json({ error: "Failed to activate employee profile" }, 500);
      }
      const duplicateIds = validInvites
        .map((p: any) => p.id)
        .filter((id: string) => id !== preferredInvite.id);
      if (duplicateIds.length) await admin.from("profiles").delete().in("id", duplicateIds);
    }

    return json({
      ok: true,
      claimed: validInvites.length,
      active_company_id: preferredInvite.company_id,
      role: preferredInvite.pending_role || "crew",
    });
  } catch (error) {
    console.error("claim-employee-invites error", error);
    return json({ error: "Internal server error" }, 500);
  }
});