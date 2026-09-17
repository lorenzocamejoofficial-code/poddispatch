import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hourly sweep: for any approved company whose owner never logged in within
// 7 days of approval, force-start the trial timer at the grace deadline so
// the 30-day countdown can't be indefinitely paused.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // This sweep writes trial timers for EVERY company, so only the scheduler
  // (service role, or the cron shared secret) may run it. A signed-in user's
  // JWT — or the public anon key — must not be able to trigger global writes.
  const auth = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SHARED_SECRET");
  const authorized =
    auth === `Bearer ${serviceRoleKey}` ||
    (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey,
  );

  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("subscription_records")
    .select("id, company_id, approval_grace_deadline")
    .eq("subscription_status", "trial_pending_start")
    .is("trial_started_at", null)
    .not("approval_grace_deadline", "is", null)
    .lt("approval_grace_deadline", nowIso);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let started = 0;
  for (const r of rows ?? []) {
    const startAt = (r as any).approval_grace_deadline as string;
    await supabaseAdmin
      .from("subscription_records")
      .update({
        trial_started_at: startAt,
        subscription_status: "trial_active",
        updated_at: nowIso,
      })
      .eq("id", (r as any).id);
    await supabaseAdmin.from("onboarding_events").insert({
      company_id: (r as any).company_id,
      event_type: "trial_started",
      details: { trigger: "grace_deadline_sweep", grace_deadline: startAt },
    });
    started++;
  }

  return new Response(JSON.stringify({ swept: started }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});