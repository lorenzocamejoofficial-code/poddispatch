import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Cron-invoked daily. Scans crew_certifications for upcoming/past expirations,
// notifies the crew member + company admins at 90/60/30/7/0 day milestones,
// and flips approved certs to status='expired' once past their expiration date.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const CERT_LABEL: Record<string, string> = {
    medic_number: "Medic/EMT certification",
    cpr: "CPR card",
    drivers_license: "Driver's license",
  };

  const MILESTONES = [90, 60, 30, 7, 0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  try {
    // 1) Flip approved but past-expiration certs to "expired"
    const { error: expireErr } = await sb
      .from("crew_certifications")
      .update({ status: "expired" })
      .eq("status", "approved")
      .lt("expiration_date", todayStr);
    if (expireErr) console.error("expire update failed:", expireErr);

    // 2) Pull all approved/pending/expired certs that have an expiration_date
    const { data: certs, error } = await sb
      .from("crew_certifications")
      .select("id, user_id, company_id, cert_type, expiration_date, status")
      .not("expiration_date", "is", null)
      .in("status", ["approved", "expired", "pending_review"]);
    if (error) throw error;

    let notified = 0;

    for (const c of certs ?? []) {
      const exp = new Date(c.expiration_date + "T00:00:00");
      exp.setHours(0, 0, 0, 0);
      const days = Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (!MILESTONES.includes(days) && days >= 0) continue;
      // For past expiration, only emit on the day it expires (days = 0 handled by includes)
      // and resend nothing afterwards.
      if (days < 0 && days !== -0) continue;

      const label = CERT_LABEL[c.cert_type] ?? c.cert_type;
      const message =
        days === 0
          ? `Your ${label} expires today. You will be blocked from truck assignments after today.`
          : `Your ${label} expires in ${days} days. Please upload a renewal before it lapses.`;

      // Dedupe: skip if a similar notification was created in the last 20 hours
      const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { count } = await sb
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", c.user_id)
        .eq("notification_type", "cert_expiration")
        .gte("created_at", since)
        .ilike("message", `%${label}%${days === 0 ? "today" : `in ${days} days`}%`);
      if ((count ?? 0) > 0) continue;

      // Notify the crew member
      await sb.from("notifications").insert({
        user_id: c.user_id,
        message,
        notification_type: "cert_expiration",
      });
      notified++;

      // Notify owners + managers in the same company
      const { data: admins } = await sb
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", c.company_id)
        .in("role", ["owner", "manager", "creator"]);

      // Look up the crew member's name once
      const { data: prof } = await sb
        .from("profiles")
        .select("full_name")
        .eq("user_id", c.user_id)
        .maybeSingle();
      const who = prof?.full_name ?? "A crew member";
      const adminMsg =
        days === 0
          ? `${who}'s ${label} expires today and they will be blocked from truck assignments after today.`
          : `${who}'s ${label} expires in ${days} days.`;

      for (const a of admins ?? []) {
        if (a.user_id === c.user_id) continue;
        await sb.from("notifications").insert({
          user_id: a.user_id,
          message: adminMsg,
          notification_type: "cert_expiration",
        });
        notified++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, notified, scanned: certs?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("check-cert-expirations failed:", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});