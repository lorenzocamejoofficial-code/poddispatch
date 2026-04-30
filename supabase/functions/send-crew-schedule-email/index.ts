import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendViaResend } from "../_shared/send-via-resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const actor = userData.user;

    const body = await req.json().catch(() => ({}));
    const { kind, to, subject, message } = body ?? {};

    if (!to || typeof to !== "string" || !EMAIL_REGEX.test(to.trim())) {
      return json({ error: "Valid recipient email required" }, 400);
    }
    if (!subject || typeof subject !== "string") return json({ error: "Subject required" }, 400);
    if (!message || typeof message !== "string") return json({ error: "Message body required" }, 400);
    if (!["invite", "schedule"].includes(kind)) return json({ error: "Invalid kind" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Caller must be owner/creator/dispatcher of a company
    const { data: actorMembership } = await admin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", actor.id)
      .maybeSingle();

    if (!actorMembership || !["owner", "creator", "dispatcher"].includes(actorMembership.role as string)) {
      return json({ error: "Forbidden" }, 403);
    }

    // Look up tenant company name so the From: header is operator-branded
    // ("{Company} via PodDispatch" instead of plain "PodDispatch").
    const { data: companyRow } = await admin
      .from("companies")
      .select("name")
      .eq("id", actorMembership.company_id)
      .maybeSingle();
    const tenantName = (companyRow?.name as string | undefined) ?? undefined;

    // Render plain-text body inside a simple HTML wrapper so line breaks survive
    const escapedMessage = message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = `<!doctype html><html><body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
      <tr><td style="font-size:14px;line-height:1.6;color:#1f2937;white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Courier New',monospace;">${escapedMessage}</td></tr>
    </table>
    <div style="font-size:11px;color:#94a3b8;padding-top:16px;">Sent by PodDispatch · noreply@thepoddispatch.com</div>
  </td></tr>
</table></body></html>`;

    const result = await sendViaResend({
      to: to.trim(),
      subject: subject.trim(),
      html,
      text: message,
      reply_to: actor.email ?? undefined,
      email_type: kind === "invite" ? "crew_invite" : "crew_schedule",
      company_id: actorMembership.company_id,
      from_name: tenantName,
    });

    if (!result.ok) {
      return json({ error: result.error || "Send failed" }, 502);
    }

    // Audit
    await admin.from("admin_actions").insert({
      company_id: actorMembership.company_id,
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      action: kind === "invite" ? "crew_invite_emailed" : "crew_schedule_emailed",
      before_snapshot: { recipient: to.trim(), subject: subject.trim() },
    } as never);

    return json({ ok: true, id: result.id });
  } catch (e) {
    console.error("send-crew-schedule-email error", e);
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}