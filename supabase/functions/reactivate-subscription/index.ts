import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const { company_id } = body ?? {};
    if (!company_id || typeof company_id !== "string") {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await userClient
      .from("company_memberships")
      .select("role")
      .eq("company_id", company_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership || !["owner", "creator"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Only the company owner can reactivate" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: sub } = await admin
      .from("subscription_records")
      .select("subscription_status, stripe_subscription_id, reactivation_deadline")
      .eq("company_id", company_id)
      .maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ error: "No subscription on file" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = sub.subscription_status as string;
    const stripeSubId = (sub as any).stripe_subscription_id as string | null;
    const now = new Date();

    // Scheduled-to-cancel paid sub — flip cancel_at_period_end off.
    if (status === "pending_cancellation" && stripeSubId && stripeSecret) {
      const stripe = new Stripe(stripeSecret, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      });
      await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: false });
      await admin
        .from("subscription_records")
        .update({
          subscription_status: "active",
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: now.toISOString(),
        })
        .eq("company_id", company_id);
      return new Response(JSON.stringify({ ok: true, mode: "uncanceled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fully canceled — within 90-day window, route to /choose-plan to re-checkout.
    if (status === "cancelled") {
      const deadline = (sub as any).reactivation_deadline
        ? new Date((sub as any).reactivation_deadline).getTime()
        : 0;
      if (deadline && deadline < Date.now()) {
        return new Response(JSON.stringify({ error: "Reactivation window has expired. Contact support." }), {
          status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, mode: "requires_checkout" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Subscription is ${status}; nothing to reactivate.` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("reactivate-subscription error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});