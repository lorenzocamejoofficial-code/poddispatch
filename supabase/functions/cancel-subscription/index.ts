import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_REASONS = new Set([
  "too_expensive",
  "switched_competitor",
  "going_out_of_business",
  "missing_feature",
  "too_complex",
  "other",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { company_id, reason, feedback } = body ?? {};
    if (!company_id || typeof company_id !== "string") {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const normalizedReason = typeof reason === "string" && ALLOWED_REASONS.has(reason) ? reason : "other";
    const normalizedFeedback = typeof feedback === "string" ? feedback.slice(0, 2000) : null;

    // Owner-only
    const { data: membership } = await userClient
      .from("company_memberships")
      .select("role")
      .eq("company_id", company_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership || !["owner", "creator"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only the company owner can cancel" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: sub, error: subErr } = await admin
      .from("subscription_records")
      .select("subscription_status, stripe_subscription_id, trial_ends_at, current_period_end")
      .eq("company_id", company_id)
      .maybeSingle();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "No subscription on file" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = sub.subscription_status as string;
    const stripeSubId = (sub as any).stripe_subscription_id as string | null;
    const now = new Date();

    // Trial — no live Stripe sub yet. Cancel immediately (read-only).
    if (status === "trial" || status === "pending" || !stripeSubId) {
      const { error: updErr } = await admin
        .from("subscription_records")
        .update({
          subscription_status: "cancelled",
          cancel_at_period_end: false,
          canceled_at: now.toISOString(),
          cancel_reason: normalizedReason,
          cancel_feedback: normalizedFeedback,
          reactivation_deadline: new Date(now.getTime() + 90 * 86_400_000).toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("company_id", company_id);
      if (updErr) throw updErr;

      return new Response(JSON.stringify({
        ok: true,
        mode: "immediate",
        message: "Trial cancelled. No charges were or will be made.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Paid sub — schedule cancellation at period end via Stripe.
    if (!stripeSecret) {
      return new Response(JSON.stringify({ error: "Billing is not configured on the server" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const updated = await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
      metadata: { cancel_reason: normalizedReason },
    });
    const periodEnd = new Date((updated.current_period_end ?? 0) * 1000);

    const { error: updErr } = await admin
      .from("subscription_records")
      .update({
        subscription_status: "pending_cancellation",
        cancel_at_period_end: true,
        canceled_at: now.toISOString(),
        cancel_reason: normalizedReason,
        cancel_feedback: normalizedFeedback,
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("company_id", company_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({
      ok: true,
      mode: "at_period_end",
      ends_at: periodEnd.toISOString(),
      message: `Subscription will cancel on ${periodEnd.toDateString()}. You keep full access until then.`,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("cancel-subscription error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});