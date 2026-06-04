import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaResend } from "../_shared/send-via-resend.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-shot: resends the signup acknowledgment to a specific company_id.
// Caller must be a system creator.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { company_id } = await req.json();
    if (!company_id) return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: company } = await admin.from("companies").select("id, name, owner_email, owner_user_id").eq("id", company_id).maybeSingle();
    if (!company?.owner_email) return new Response(JSON.stringify({ error: "no owner email" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    const { data: profile } = await admin.from("profiles").select("full_name").eq("user_id", company.owner_user_id).maybeSingle();

    const safeCompany = String(company.name).replace(/[<>]/g, "");
    const safeName = String(profile?.full_name ?? "there").replace(/[<>]/g, "");
    const email = company.owner_email as string;
    const logoUrl = "https://app.thepoddispatch.com/email-logo.png";
    const supportEmail = "support@thepoddispatch.com";
    const html = `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<tr><td style="background:#1e3a5f;padding:24px 32px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:12px;"><img src="${logoUrl}" width="36" height="36" alt="PodDispatch" style="display:block;border:0;"/></td>
<td style="vertical-align:middle;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">PodDispatch</td>
</tr></table></td></tr>
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;font-weight:700;">Thank you for signing up, ${safeName}.</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">We received your PodDispatch application for <strong style="color:#1e3a5f;">${safeCompany}</strong>. Your account is now under review by our team.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">Reviews typically complete within one business day. You will receive a second email the moment your account is approved, along with a link to sign in and begin onboarding.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;"><tr><td style="padding:16px 20px;font-size:14px;color:#475569;line-height:1.6;">
<strong style="color:#0f172a;">What happens next:</strong><br/>1. Our team verifies your NPI, EIN, and OIG exclusion status.<br/>2. We confirm your service area and Medicare locality.<br/>3. You receive an approval email with sign in instructions.
</td></tr></table>
<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#475569;">Questions in the meantime? Reply directly to this email, or contact us at <a href="mailto:${supportEmail}" style="color:#1e3a5f;font-weight:600;">${supportEmail}</a>.</p>
</td></tr>
<tr><td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 32px;font-size:12px;color:#94a3b8;line-height:1.5;">This message was sent to ${email} because an application was submitted at thepoddispatch.com. If this was not you, please contact <a href="mailto:${supportEmail}" style="color:#64748b;">${supportEmail}</a> immediately.</td></tr>
</table>
<div style="font-size:11px;color:#94a3b8;padding-top:16px;">PodDispatch, Inc. &middot; noreply@thepoddispatch.com</div>
</td></tr></table></body></html>`;
    const text = `Thank you for signing up, ${safeName}.\n\nWe received your PodDispatch application for ${safeCompany}. Your account is now under review.\n\nReviews typically complete within one business day.\n\nWhat happens next:\n1. We verify your NPI, EIN, and OIG exclusion status.\n2. We confirm your service area and Medicare locality.\n3. You receive an approval email with sign in instructions.\n\nQuestions? Reply to this email or contact ${supportEmail}.`;

    const result = await sendViaResend({
      to: email,
      subject: `We received your PodDispatch application, ${safeName}`,
      html, text, reply_to: supportEmail,
      email_type: "other", company_id: company.id, recipient_user_id: company.owner_user_id,
    });
    return new Response(JSON.stringify(result), { status: result.ok ? 200 : 502, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});