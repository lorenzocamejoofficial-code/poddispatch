import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    const foundingPrice = Deno.env.get("STRIPE_PRICE_FOUNDING");
    const starterPrice = Deno.env.get("STRIPE_PRICE_STANDARD"); // 1–5 trucks · $799/mo
    const proPrice = Deno.env.get("STRIPE_PRICE_PRO");           // 6+ trucks · $1,499/mo
    const starterAnnual = Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL"); // $7,990/yr
    const proAnnual = Deno.env.get("STRIPE_PRICE_PRO_ANNUAL");         // $14,990/yr

    if (!stripeSecret || !starterPrice || !proPrice || !foundingPrice) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Require authenticated caller — checkout sessions must not be created
    // anonymously, otherwise an attacker could attach a paid subscription to
    // any company by spoofing company_id/user_id in the body.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { company_id, user_id, plan, billing_cycle } = body ?? {};
    const requestedPlan: "starter" | "pro" = plan === "pro" ? "pro" : "starter";
    const cycle: "monthly" | "yearly" = billing_cycle === "yearly" ? "yearly" : "monthly";

    if (!company_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "company_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Caller must be the user being charged AND a member of the target company
    if (String(user_id) !== userData.user.id) {
      return new Response(
        JSON.stringify({ error: "user_id mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { data: membership } = await userClient
      .from("company_memberships")
      .select("role")
      .eq("company_id", String(company_id))
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership || !["owner", "creator"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Only company owners can start checkout" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Service-role client for founding-slot reservation (bypasses RLS).
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Founding auto-swap: only on the Starter tier and only for the first
    // 5 paid conversions. Atomic via try_claim_founding_slot().
    let chosenPlan: "starter" | "pro" | "founding" = requestedPlan;
    let priceId: string | undefined =
      requestedPlan === "pro"
        ? (cycle === "yearly" ? proAnnual : proPrice)
        : (cycle === "yearly" ? starterAnnual : starterPrice);
    let isFounding = false;

    // Founding lifetime lock is monthly-only — never swap on yearly checkouts.
    if (requestedPlan === "starter" && cycle === "monthly") {
      const { data: claimed, error: claimErr } = await admin.rpc("try_claim_founding_slot");
      if (claimErr) console.error("founding claim err", claimErr);
      if (claimed === true) {
        chosenPlan = "founding";
        priceId = foundingPrice;
        isFounding = true;
      }
    }

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: `Missing Stripe price for ${requestedPlan} ${cycle}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Honor the app-gated trial in Stripe so the card on file is not charged
    // until the trial truly ends. We read the company's existing
    // trial_ends_at and convert remaining whole days into trial_period_days.
    // Stripe accepts 1–730. If the app trial has already expired (or there
    // is no record), we skip the Stripe trial and charge immediately.
    let trialPeriodDays: number | undefined;
    try {
      const { data: subRec } = await admin
        .from("subscription_records")
        .select("trial_ends_at")
        .eq("company_id", String(company_id))
        .maybeSingle();
      const endsAt = (subRec as any)?.trial_ends_at
        ? new Date((subRec as any).trial_ends_at).getTime()
        : 0;
      if (endsAt > Date.now()) {
        const daysLeft = Math.ceil((endsAt - Date.now()) / 86_400_000);
        trialPeriodDays = Math.min(730, Math.max(1, daysLeft));
      }
    } catch (e) {
      console.warn("trial_ends_at lookup failed; proceeding without Stripe trial", e);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://thepoddispatch.com/onboarding?payment=success",
      cancel_url: "https://thepoddispatch.com/complete-payment?payment=cancelled",
      payment_method_collection: "always",
      metadata: {
        company_id: String(company_id),
        user_id: String(user_id),
        plan_id: chosenPlan,
        is_founding: String(isFounding),
        billing_cycle: cycle,
      },
      subscription_data: {
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        metadata: {
          company_id: String(company_id),
          user_id: String(user_id),
          plan_id: chosenPlan,
          is_founding: String(isFounding),
          billing_cycle: cycle,
        },
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, id: session.id, plan: chosenPlan, is_founding: isFounding, billing_cycle: cycle }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});