// System creator replies to a support ticket. Sends the creator_notes (or
// a custom message) to the original submitter via Resend. Optionally marks
// the ticket resolved.
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

    // Verify creator
    const { data: isCreator } = await supabase.rpc("is_system_creator");
    if (!isCreator) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { ticket_id, message, mark_resolved } = body as {
      ticket_id?: string; message?: string; mark_resolved?: boolean;
    };
    if (!ticket_id || !message?.trim()) {
      return new Response(JSON.stringify({ error: "ticket_id and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: ticket } = await admin
      .from("support_tickets")
      .select("id, ticket_number, subject, user_id, company_id")
      .eq("id", ticket_id).maybeSingle();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles").select("full_name, email").eq("id", ticket.user_id).maybeSingle();
    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "Submitter has no email on file" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const replyTo = Deno.env.get("SUPPORT_NOTIFICATION_EMAIL") ?? "support@thepoddispatch.com";
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:24px;">
<div style="max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
  <div style="font-size:12px;color:#64748b;margin-bottom:8px;">Re: ${escape(ticket.ticket_number ?? "")} — ${escape(ticket.subject ?? "Support ticket")}</div>
  <h2 style="margin:0 0 16px;font-size:18px;">PodDispatch Support Reply</h2>
  <div style="font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-wrap;">${escape(message.trim())}</div>
  ${mark_resolved ? `<div style="margin-top:20px;padding:12px;background:#f0fdf4;border-left:3px solid #16a34a;font-size:13px;color:#166534;">This ticket has been marked as resolved. Reply to this email if you need further assistance.</div>` : ""}
  <div style="margin-top:24px;font-size:12px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:12px;">Reply directly to this email to continue the conversation.</div>
</div>
</body></html>`;

    const result = await sendViaResend({
      to: profile.email,
      subject: `Re: [${ticket.ticket_number}] ${ticket.subject || "Your support request"}`,
      html,
      reply_to: replyTo,
      email_type: "other",
      company_id: ticket.company_id,
      recipient_user_id: ticket.user_id,
    });

    if (mark_resolved && result.ok) {
      await admin.from("support_tickets")
        .update({ status: "resolved", creator_notes: message.trim() })
        .eq("id", ticket_id);
    } else if (result.ok) {
      // Still persist the latest creator note
      await admin.from("support_tickets")
        .update({ creator_notes: message.trim() })
        .eq("id", ticket_id);
    }

    return new Response(JSON.stringify({ ok: result.ok, error: result.error }), {
      status: result.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reply-support-ticket error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});