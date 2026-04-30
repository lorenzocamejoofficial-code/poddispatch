// Shared helper: send a transactional email through Resend from
// noreply@thepoddispatch.com. Returns { ok, id?, error? } and never throws —
// callers decide whether a delivery failure should fail their flow.
//
// Requires the RESEND_API_KEY secret. The sending domain (thepoddispatch.com)
// must be verified in the Resend dashboard.

const DEFAULT_FROM_ADDRESS = "PodDispatch <noreply@thepoddispatch.com>";
const FROM_EMAIL = "noreply@thepoddispatch.com";
const DEFAULT_FROM_NAME = "PodDispatch";

// Sanitize a tenant company name for safe use inside an RFC 5322 display name.
// Strips quotes, angle brackets, line breaks, and trims to a reasonable length.
function sanitizeFromName(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/[\r\n"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  // Optional override for the From display name. When provided (typically a
  // tenant company name), the sender appears as "{from_name} via PodDispatch
  // <noreply@thepoddispatch.com>". The sending address never changes — only
  // the display name in the From: header is rebranded.
  from_name?: string;
  // Logging context (optional — when omitted, row still logs with company_id null)
  email_type?: "password_reset" | "signup_verification" | "crew_invite" | "crew_schedule" | "other";
  company_id?: string | null;
  recipient_user_id?: string | null;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  status?: number;
}

export async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }
  if (!input?.to || !input?.subject || !input?.html) {
    return { ok: false, error: "to, subject, and html are required" };
  }

  // Build From: header. Tenant emails get "{Company} via PodDispatch", system
  // emails (no override) keep the plain "PodDispatch" identity.
  const cleanedTenantName = sanitizeFromName(input.from_name);
  const effectiveFromName = cleanedTenantName
    ? `${cleanedTenantName} via PodDispatch`
    : DEFAULT_FROM_NAME;
  const fromAddress = cleanedTenantName
    ? `${effectiveFromName} <${FROM_EMAIL}>`
    : DEFAULT_FROM_ADDRESS;

  // Insert pending log row via service role (best-effort — never block sending)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let logId: string | null = null;
  if (supabaseUrl && serviceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/email_send_log`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          company_id: input.company_id ?? null,
          recipient_email: input.to,
          recipient_user_id: input.recipient_user_id ?? null,
          email_type: input.email_type ?? "other",
          subject: input.subject,
          from_address: FROM_EMAIL,
          from_name: effectiveFromName,
          status: "pending",
        }),
      });
      const rows = await res.json().catch(() => null);
      if (Array.isArray(rows) && rows[0]?.id) logId = rows[0].id;
    } catch (e) {
      console.error("email_send_log pending insert failed", e);
    }
  }

  const updateLog = async (patch: Record<string, unknown>) => {
    if (!logId || !supabaseUrl || !serviceKey) return;
    try {
      await fetch(`${supabaseUrl}/rest/v1/email_send_log?id=eq.${logId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(patch),
      });
    } catch (e) {
      console.error("email_send_log update failed", e);
    }
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.reply_to ? { reply_to: input.reply_to } : {}),
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (body && (body.message || body.error)) ||
        `Resend responded with HTTP ${res.status}`;
      console.error("sendViaResend failed", res.status, body);
      await updateLog({
        status: "failed",
        error_message: String(message).slice(0, 1000),
      });
      return { ok: false, error: String(message), status: res.status };
    }
    await updateLog({
      status: "sent",
      resend_email_id: body?.id ?? null,
      sent_at: new Date().toISOString(),
    });
    return { ok: true, id: body?.id, status: res.status };
  } catch (err) {
    console.error("sendViaResend threw", err);
    await updateLog({
      status: "failed",
      error_message: ((err as Error)?.message || "network error").slice(0, 1000),
    });
    return { ok: false, error: (err as Error)?.message || "network error" };
  }
}

// Minimal branded HTML wrapper so all auth/invite emails look consistent.
export function renderActionEmail(opts: {
  heading: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  footer?: string;
}): { html: string; text: string } {
  const { heading, intro, actionLabel, actionUrl, footer } = opts;
  const safeUrl = actionUrl.replace(/"/g, "&quot;");
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
            <tr><td style="font-size:20px;font-weight:700;color:#0f172a;padding-bottom:12px;">${heading}</td></tr>
            <tr><td style="font-size:14px;line-height:1.6;color:#334155;padding-bottom:24px;">${intro}</td></tr>
            <tr><td align="left" style="padding-bottom:24px;">
              <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">${actionLabel}</a>
            </td></tr>
            <tr><td style="font-size:12px;color:#64748b;line-height:1.5;padding-bottom:8px;">If the button doesn't work, copy and paste this URL into your browser:</td></tr>
            <tr><td style="font-size:12px;color:#475569;word-break:break-all;padding-bottom:24px;"><a href="${safeUrl}" style="color:#475569;">${safeUrl}</a></td></tr>
            ${footer ? `<tr><td style="font-size:12px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:16px;">${footer}</td></tr>` : ""}
          </table>
          <div style="font-size:11px;color:#94a3b8;padding-top:16px;">Sent by PodDispatch · noreply@thepoddispatch.com</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = `${heading}\n\n${intro}\n\n${actionLabel}: ${actionUrl}\n\n${footer ?? ""}`.trim();
  return { html, text };
}

// Build a recovery URL that points DIRECTLY at the app's /reset-password page,
// bypassing Supabase's redirect allow-list. The page calls
// supabase.auth.verifyOtp({ type: 'recovery', token_hash }) to establish the
// recovery session, then prompts for a new password.
//
// Use the `hashed_token` from supabase.auth.admin.generateLink({ type: 'recovery' }).
export function buildAppRecoveryUrl(opts: {
  appOrigin: string;
  hashedToken: string;
  email?: string;
}): string {
  const origin = opts.appOrigin.replace(/\/$/, "");
  const params = new URLSearchParams({
    token_hash: opts.hashedToken,
    type: "recovery",
  });
  if (opts.email) params.set("email", opts.email);
  return `${origin}/reset-password?${params.toString()}`;
}