import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hourly sweep: persist the trial → expired transition.
//
// The app used to compute expiry in browser memory only, so the stored status
// disagreed with what the owner actually experienced. This job writes the
// transition the shared trial-window helper computes:
//     expired  ⇔  trial_ends_at (or trial_started_at + 30d) <= now
// so the database, the metrics and the login gate can never disagree.
//
// It only changes subscription_status / trial_expired_at. Founding status,
// pricing and truck caps are never touched.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const TRIAL_LENGTH_MS = 30 * 24 * 60 * 60 * 1000;

// Statuses that represent a running trial. Anything else (paid, cancelled,
// pending payment, already expired) is left alone.
const TRIAL_STATUSES = ["trial", "trial_active", "TEST_ACTIVE"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Scheduler-only: this writes status for every company.
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

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("subscription_records")
    .select("id, company_id, subscription_status, trial_started_at, trial_ends_at, trial_expired_at, is_comped")
    .in("subscription_status", TRIAL_STATUSES);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let expired = 0;
  const skipped: string[] = [];

  for (const r of rows ?? []) {
    const row = r as any;
    // Comped companies never expire off a trial clock — the creator owns them.
    if (row.is_comped) { skipped.push(row.company_id); continue; }

    const end = row.trial_ends_at
      ? new Date(row.trial_ends_at).getTime()
      : row.trial_started_at
        ? new Date(row.trial_started_at).getTime() + TRIAL_LENGTH_MS
        : null;

    if (end == null || isNaN(end) || end > now) continue;

    // Backfill the stored end date if it was only derivable.
    const patch: Record<string, unknown> = {
      subscription_status: "trial_expired",
      trial_expired_at: nowIso,
      updated_at: nowIso,
    };
    if (!row.trial_ends_at) patch.trial_ends_at = new Date(end).toISOString();

    // Idempotent: the status filter above already excludes rows we've expired.
    const { error: upErr } = await supabaseAdmin
      .from("subscription_records")
      .update(patch)
      .eq("id", row.id)
      .in("subscription_status", TRIAL_STATUSES);
    if (upErr) { console.error("sweep-trial-expiry update failed", row.id, upErr.message); continue; }

    // subscription_status_history is written automatically by the
    // log_subscription_status_change trigger on status change.
    await supabaseAdmin.from("onboarding_events").insert({
      company_id: row.company_id,
      event_type: "trial_expired",
      details: { trigger: "sweep_trial_expiry", trial_ends_at: new Date(end).toISOString() },
    });
    expired++;
  }

  return new Response(JSON.stringify({ expired, skipped_comped: skipped.length, checked: (rows ?? []).length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
