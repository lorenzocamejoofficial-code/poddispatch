import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend, renderActionEmail } from "../_shared/send-via-resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth header" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: cu } = await caller.auth.getUser();
    if (!cu?.user) return json({ error: "Unauthorized" }, 401);

    const { data: callerMem } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", cu.user.id)
      .in("role", ["owner", "creator", "manager"])
      .maybeSingle();
    if (!callerMem) return json({ error: "Admin access required" }, 403);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const profile_id: string | undefined = body?.profile_id;
    if (!profile_id) return json({ error: "profile_id required" }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, company_id, email, full_name, pending_role, invitation_status, user_id")
      .eq("id", profile_id)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 404);
    if (profile.company_id !== callerMem.company_id) return json({ error: "Profile not in your company" }, 403);
    if (!profile.email) return json({ error: "Profile has no email on file" }, 400);
    if (profile.user_id) return json({ error: "User already has an active account" }, 400);

    // Find or create the token row.
    const { data: existingInvite } = await admin
      .from("company_invites")
      .select("id, token")
      .eq("profile_id", profile_id)
      .maybeSingle();

    let token = existingInvite?.token as string | undefined;
    if (!existingInvite) {
      const { data: created, error: insErr } = await admin
        .from("company_invites")
        .insert({ profile_id, created_by_user_id: cu.user.id } as any)
        .select("token")
        .single();
      if (insErr) return json({ error: "Failed to create invite token: " + insErr.message }, 500);
      token = created!.token;
    }

    // Mark profile as invited (covers pending_invite -> invited transition).
    if (profile.invitation_status !== "invited") {
      await admin.from("profiles").update({ invitation_status: "invited" } as any).eq("id", profile_id);
    }

    const { data: companyRow } = await admin
      .from("companies").select("name").eq("id", profile.company_id).maybeSingle();
    const tenantName = (companyRow?.name as string | undefined) ?? undefined;

    const appOrigin = Deno.env.get("APP_URL") || "https://app.thepoddispatch.com";
    const actionUrl = `${appOrigin.replace(/\/$/, "")}/invite?token=${token}`;

    const { html, text } = renderActionEmail({
      heading: `You've been invited to ${tenantName ?? "PodDispatch"}`,
      intro:
        `You've been invited to join ${tenantName ?? "the team"} on PodDispatch as ${profile.pending_role ?? "a team member"}. Click the button below to set your password and finish setting up your account.`,
      actionLabel: "Accept invite",
      actionUrl,
      footer: "If you weren't expecting this invite, you can safely ignore this email.",
    });
    const delivery = await sendViaResend({
      to: profile.email,
      subject: `Your invite to ${tenantName ?? "PodDispatch"}`,
      html,
      text,
      email_type: "crew_invite",
      company_id: profile.company_id,
      from_name: tenantName,
    });

    return json({
      ok: true,
      action_link: actionUrl,
      email: profile.email,
      email_delivered: delivery.ok,
      email_error: delivery.ok ? undefined : delivery.error,
    });
  } catch (e) {
    console.error("send-employee-invite error", e);
    return json({ error: "Internal server error" }, 500);
  }
});