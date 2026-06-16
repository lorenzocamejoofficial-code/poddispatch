import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Starts the 30-day app-side trial timer the first time the owner logs in
// after approval. Idempotent — calling it repeatedly is a no-op once the
// trial has already started (or if the company was skipped / paid).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const { company_id } = await req.json();
    if (!company_id || typeof company_id !== "string") {
      return new Response(JSON.stringify({ error: "company_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the caller is a member of this company.
    const { data: membership } = await supabaseAdmin
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", company_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await supabaseAdmin
      .from("subscription_records")
      .select("id, subscription_status, trial_started_at, trial_skipped")
      .eq("company_id", company_id)
      .maybeSingle();

    if (!sub) {
      return new Response(JSON.stringify({ started: false, reason: "no_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (sub.trial_skipped || sub.trial_started_at) {
      return new Response(JSON.stringify({ started: false, reason: "already_resolved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (sub.subscription_status !== "trial_pending_start") {
      return new Response(JSON.stringify({ started: false, reason: "not_pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("subscription_records")
      .update({
        trial_started_at: now,
        subscription_status: "trial_active",
        updated_at: now,
      })
      .eq("id", sub.id);

    await supabaseAdmin.from("onboarding_events").insert({
      company_id, event_type: "trial_started",
      actor_user_id: user.id, actor_email: user.email,
      details: { trigger: "first_login" },
    });

    return new Response(JSON.stringify({ started: true, trial_started_at: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("start-trial-timer-if-needed error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});