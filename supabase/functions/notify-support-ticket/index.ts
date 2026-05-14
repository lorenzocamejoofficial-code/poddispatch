// Notifies SUPPORT_NOTIFICATION_EMAIL (default support@thepoddispatch.com)
// when a new support ticket is submitted. Invoked by the client right after
// the support_tickets row is inserted.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendViaResend } from "../_shared/send-via-resend.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticket_id } = await req.json().catch(() => ({}));
    if (!ticket_id || typeof ticket_id !== "string") {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read full ticket + company info
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: tErr } = await admin
      .from("support_tickets")
      .select("id, ticket_number, subject, severity, category, page_path, trying_to_do, what_happened, client_context, created_at, company_id, user_id")
      .eq("id", ticket_id)
      .maybeSingle();
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: company }, { data: profile }] = await Promise.all([
      admin.from("companies").select("name").eq("id", ticket.company_id).maybeSingle(),
      admin.from("profiles").select("full_name, email").eq("id", ticket.user_id).maybeSingle(),
    ]);

    const recipient = Deno.env.get("SUPPORT_NOTIFICATION_EMAIL") ?? "support@thepoddispatch.com";
    const sevColor: Record<string, string> = {
      urgent: "#dc2626", high: "#ea580c", normal: "#0f172a", low: "#64748b",
    };
    const escape = (s: string | null | undefined) =>
      String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;">
<div style="max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
  <div style="font-size:12px;color:#64748b;margin-bottom:8px;">${escape(ticket.ticket_number)}</div>
  <h2 style="margin:0 0 8px;font-size:18px;">${escape(ticket.subject) || "(no subject)"}</h2>
  <div style="margin:8px 0 16px;">
    <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${sevColor[ticket.severity] ?? "#0f172a"};color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">${escape(ticket.severity)}</span>
    ${ticket.category ? `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:#f1f5f9;color:#0f172a;font-size:11px;margin-left:6px;">${escape(ticket.category)}</span>` : ""}
  </div>
  <table style="width:100%;font-size:13px;color:#334155;border-collapse:collapse;">
    <tr><td style="padding:4px 0;width:120px;color:#64748b;">Company</td><td>${escape(company?.name) || "(unknown)"}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;">Submitter</td><td>${escape(profile?.full_name) || "(unknown)"} &lt;${escape(profile?.email) || ""}&gt;</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;">Page</td><td>${escape(ticket.page_path) || "—"}</td></tr>
    <tr><td style="padding:4px 0;color:#64748b;">Submitted</td><td>${escape(ticket.created_at)}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
  <div style="font-size:13px;color:#0f172a;"><strong>What they were trying to do:</strong><br/>${escape(ticket.trying_to_do)?.replace(/\n/g, "<br/>") || "—"}</div>
  <div style="margin-top:12px;font-size:13px;color:#0f172a;"><strong>What happened:</strong><br/>${escape(ticket.what_happened)?.replace(/\n/g, "<br/>") || "—"}</div>
  ${ticket.client_context ? `<details style="margin-top:16px;font-size:12px;color:#64748b;"><summary>Client context</summary><pre style="white-space:pre-wrap;background:#f8fafc;padding:8px;border-radius:6px;font-size:11px;">${escape(JSON.stringify(ticket.client_context, null, 2))}</pre></details>` : ""}
  <div style="margin-top:20px;font-size:12px;color:#94a3b8;">Open in Creator Console → Support tab to triage.</div>
</div>
</body></html>`;

    const result = await sendViaResend({
      to: recipient,
      subject: `[${ticket.ticket_number}] ${ticket.severity.toUpperCase()} — ${ticket.subject || "Support ticket"}`,
      html,
      reply_to: profile?.email ?? undefined,
      email_type: "other",
      company_id: ticket.company_id,
    });

    return new Response(JSON.stringify({ ok: result.ok, recipient, error: result.error }), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-support-ticket error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});