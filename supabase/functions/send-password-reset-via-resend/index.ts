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

// Generic response we always return on the public reset path so we never
// leak whether an email is registered.
const GENERIC_OK = {
  ok: true,
  message: "If that email exists, a reset link has been sent.",
};

function buildResetEmail(actionUrl: string) {
  return renderActionEmail({
    heading: "Reset your password",
    intro:
      "Someone (hopefully you) requested a password reset for your PodDispatch account. Click the button below to set a new password. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
    actionLabel: "Reset Password",
    actionUrl,
    footer: "PodDispatch · Secure dispatch & billing for NEMT operators.",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    let body: any;
    try { body = await req.json(); } catch { return json({ ...GENERIC_OK }); }
    const rawEmail: unknown = body?.email;
    if (!rawEmail || typeof rawEmail !== "string") return json({ ...GENERIC_OK });
    const email = rawEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ ...GENERIC_OK });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up user in auth.users — paginate through to find by email.
    let matchingUser: any = null;
    for (let page = 1; page <= 20 && !matchingUser; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      matchingUser = (data?.users || []).find(
        (u: any) => (u.email || "").toLowerCase() === email,
      );
      if (!data?.users || data.users.length < 1000) break;
    }

    if (!matchingUser) {
      // Do not leak existence — and do not log a row, since no send was attempted.
      console.log("password-reset: no user for", email);
      return json({ ...GENERIC_OK });
    }

    const userId: string = matchingUser.id;

    // Best-effort company_id lookup (null if user has no membership)
    let companyId: string | null = null;
    const { data: membership } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (membership?.company_id) companyId = membership.company_id;

    const appOrigin = Deno.env.get("APP_URL") || "https://thepoddispatch.com";
    const redirectTo = `${appOrigin.replace(/\/$/, "")}/reset-password`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkErr || !linkData) {
      console.error("password-reset: generateLink failed", linkErr);
      return json({ ...GENERIC_OK });
    }

    const hashedToken = (linkData as any)?.properties?.hashed_token ?? null;
    const actionUrl = hashedToken
      ? buildAppRecoveryUrl({ appOrigin, hashedToken, email })
      : (linkData?.properties?.action_link ?? null);
    if (!actionUrl) return json({ ...GENERIC_OK });

    const { html, text } = buildResetEmail(actionUrl);
    await sendViaResend({
      to: email,
      subject: "Reset your PodDispatch password",
      html,
      text,
      email_type: "password_reset",
      company_id: companyId,
      recipient_user_id: userId,
    });

    return json({ ...GENERIC_OK });
  } catch (e) {
    console.error("send-password-reset-via-resend error", e);
    // Still return generic OK to avoid leaking errors to clients.
    return json({ ...GENERIC_OK });
  }
});