// Shared helper: send a transactional email through Resend from
// noreply@thepoddispatch.com. Returns { ok, id?, error? } and never throws —
// callers decide whether a delivery failure should fail their flow.
//
// Requires the RESEND_API_KEY secret. The sending domain (thepoddispatch.com)
// must be verified in the Resend dashboard.

const FROM_ADDRESS = "PodDispatch <noreply@thepoddispatch.com>";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
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

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
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
      return { ok: false, error: String(message), status: res.status };
    }
    return { ok: true, id: body?.id, status: res.status };
  } catch (err) {
    console.error("sendViaResend threw", err);
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