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

/**
 * send-test-email — admin-only diagnostic. Sends a sample tenant-branded
 * email to the caller's own address so admins can verify deliverability and
 * see exactly what their crews will see in the From: header.
 *
 * The recipient is ALWAYS the authenticated caller — there is no `to`
 * parameter, which prevents this endpoint from being repurposed as a
 * generic mail relay.
 */
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
    if (!cu?.user?.email) return json({ error: "Unauthorized" }, 401);

    // Caller must be owner/creator/dispatcher of a company.
    const { data: membership } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", cu.user.id)
      .maybeSingle();
    if (!membership || !["owner", "creator", "manager", "dispatcher"].includes(membership.role as string)) {
      return json({ error: "Admin access required" }, 403);
    }

    const { data: companyRow } = await admin
      .from("companies")
      .select("name")
      .eq("id", membership.company_id)
      .maybeSingle();
    const tenantName = (companyRow?.name as string | undefined) ?? "Your company";

    const { html, text } = renderActionEmail({
      heading: "PodDispatch test email",
      intro:
        `This is a test email triggered by an admin from <strong>${tenantName}</strong>. ` +
        "If you can read this, your crew invites, schedule emails, and password resets are working. " +
        "Check the sender name above the subject line — that is exactly what your crew members will see.",
      actionLabel: "Open PodDispatch",
      actionUrl: "https://app.thepoddispatch.com",
      footer:
        "Test email · No action required. Sent only to the admin who clicked Send Test Email.",
    });

    const delivery = await sendViaResend({
      to: cu.user.email,
      subject: `[Test] ${tenantName} via PodDispatch`,
      html,
      text,
      email_type: "other",
      company_id: membership.company_id,
      recipient_user_id: cu.user.id,
      from_name: tenantName,
    });

    return json({
      ok: delivery.ok,
      sent_to: cu.user.email,
      from_label: `${tenantName} via PodDispatch`,
      error: delivery.ok ? undefined : delivery.error,
    }, delivery.ok ? 200 : 502);
  } catch (e) {
    console.error("send-test-email error", e);
    return json({ error: "Internal server error" }, 500);
  }
});