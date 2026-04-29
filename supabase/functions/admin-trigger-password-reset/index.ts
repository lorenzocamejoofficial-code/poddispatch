import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend, renderActionEmail, buildAppRecoveryUrl } from "../_shared/send-via-resend.ts";

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: cu } = await caller.auth.getUser();
    if (!cu?.user) return json({ error: "Unauthorized" }, 401);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const targetUserId: string | undefined = body?.user_id;
    if (!targetUserId || typeof targetUserId !== "string") {
      return json({ error: "user_id required" }, 400);
    }

    // Authorize caller: system_creator OR admin (owner/creator) in same company as target.
    const { data: isCreator } = await admin
      .from("system_creators")
      .select("id")
      .eq("user_id", cu.user.id)
      .maybeSingle();

    let callerCompanyId: string | null = null;
    if (!isCreator) {
      const { data: callerMem } = await admin
        .from("company_memberships")
        .select("company_id, role")
        .eq("user_id", cu.user.id)
        .in("role", ["owner", "creator"])
        .maybeSingle();
      if (!callerMem) return json({ error: "Admin access required" }, 403);
      callerCompanyId = callerMem.company_id;

      const { data: targetMem } = await admin
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!targetMem || targetMem.company_id !== callerCompanyId) {
        return json({ error: "Target not in your company" }, 403);
      }
    }

    // Look up target user's email
    const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(targetUserId);
    if (getErr || !targetUser?.user?.email) return json({ error: "Could not load target user" }, 404);
    const email = targetUser.user.email;

    // Resolve target's company_id for logging
    let targetCompanyId: string | null = callerCompanyId;
    if (!targetCompanyId) {
      const { data: tMem } = await admin
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      targetCompanyId = tMem?.company_id ?? null;
    }

    const appOrigin = Deno.env.get("APP_URL") || "https://thepoddispatch.com";
    const redirectTo = `${appOrigin.replace(/\/$/, "")}/reset-password`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkErr) return json({ error: "Failed to generate link: " + linkErr.message }, 500);

    const hashedToken = (linkData as any)?.properties?.hashed_token ?? null;
    const actionUrl = hashedToken
      ? buildAppRecoveryUrl({ appOrigin, hashedToken, email })
      : (linkData?.properties?.action_link ?? null);

    let delivery: { ok: boolean; error?: string } = { ok: false, error: "no_action_link" };
    if (actionUrl) {
      const { html, text } = renderActionEmail({
        heading: "Reset your password",
        intro:
          "An admin from your company triggered a password reset for your PodDispatch account. Click the button below to set a new password. This link expires in 1 hour. If you didn't request this, contact your admin.",
        actionLabel: "Reset Password",
        actionUrl,
        footer: "PodDispatch · Secure dispatch & billing for NEMT operators.",
      });
      delivery = await sendViaResend({
        to: email,
        subject: "Reset your PodDispatch password",
        html,
        text,
        email_type: "password_reset",
        company_id: targetCompanyId,
        recipient_user_id: targetUserId,
      });
    }

    return json({
      ok: true,
      email,
      action_link: actionUrl,
      email_delivered: delivery.ok,
      email_error: delivery.ok ? undefined : delivery.error,
    });
  } catch (e) {
    console.error("admin-trigger-password-reset error", e);
    return json({ error: "Internal server error" }, 500);
  }
});