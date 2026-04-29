import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend, renderActionEmail } from "../_shared/send-via-resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth header" }, 401);
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: cu } = await caller.auth.getUser();
    if (!cu?.user) return json({ error: "Unauthorized" }, 401);
    const { data: cm } = await admin.from("company_memberships").select("company_id, role").eq("user_id", cu.user.id).in("role", ["owner", "creator"]).maybeSingle();
    if (!cm) return json({ error: "Owner/Creator access required" }, 403);

    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const target_user_id: string | undefined = body?.target_user_id;
    if (!target_user_id) return json({ error: "target_user_id required" }, 400);

    const { data: targetMem } = await admin.from("company_memberships").select("company_id").eq("user_id", target_user_id).maybeSingle();
    if (!targetMem || targetMem.company_id !== cm.company_id) return json({ error: "Target not in your company" }, 403);

    // Look up email via auth admin
    const { data: targetUser, error: getErr } = await admin.auth.admin.getUserById(target_user_id);
    if (getErr || !targetUser?.user?.email) return json({ error: "Could not load target user email" }, 404);
    const email = targetUser.user.email;

    // Always force the recovery link to land on the app's /reset-password page.
    // Without this, Supabase uses the project Site URL and the app auto-routes
    // the new session into the dashboard instead of showing the password form.
    const appOrigin =
      Deno.env.get("APP_URL") ||
      "https://thepoddispatch.com";
    const redirectTo =
      body?.redirect_to || `${appOrigin.replace(/\/$/, "")}/reset-password`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkErr) return json({ error: "Failed to generate invite link: " + linkErr.message }, 500);

    const actionUrl = linkData?.properties?.action_link ?? null;

    // Best-effort delivery via Resend from noreply@thepoddispatch.com.
    let delivery: { ok: boolean; error?: string; id?: string } = { ok: false, error: "no_action_link" };
    if (actionUrl) {
      const { html, text } = renderActionEmail({
        heading: "You've been invited to PodDispatch",
        intro:
          "An admin from your company re-sent your invite to PodDispatch. Click the button below to set your password and finish setting up your account. This link will expire shortly for your security.",
        actionLabel: "Set up my account",
        actionUrl,
        footer:
          "If you weren't expecting this invite, you can safely ignore this email.",
      });
      delivery = await sendViaResend({
        to: email,
        subject: "Your PodDispatch invite",
        html,
        text,
      });
      if (!delivery.ok) {
        console.error("resend-crew-invite delivery failed", delivery.error);
      }
    }

    return json({
      ok: true,
      email,
      action_link: actionUrl,
      email_delivered: delivery.ok,
      email_error: delivery.ok ? undefined : delivery.error,
    });
  } catch (e) {
    console.error("resend-crew-invite error", e);
    return json({ error: "Internal server error" }, 500);
  }
});