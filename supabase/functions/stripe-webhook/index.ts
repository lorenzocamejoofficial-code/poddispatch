import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// NOTE: STRIPE_WEBHOOK_SECRET is read from Deno.env. After deploying this
// function, register its public URL as a webhook endpoint in the Stripe
// dashboard (Developers → Webhooks → Add endpoint), then copy the resulting
// "Signing secret" (whsec_...) and add it as the STRIPE_WEBHOOK_SECRET
// project secret. Without it, signature verification will fail and all
// incoming webhook requests will be rejected with 400.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeSecret || !webhookSecret) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server not configured", { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400, headers: corsHeaders });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response(`Webhook signature failed: ${(err as Error).message}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.metadata?.company_id;
        const planId = session.metadata?.plan_id ?? null;
        const isFounding = session.metadata?.is_founding === "true";
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        let currentPeriodEnd: string | null = null;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            currentPeriodEnd = new Date((sub.current_period_end ?? 0) * 1000).toISOString();
          } catch (subErr) {
            console.error("Failed to retrieve subscription:", subErr);
          }
        }

        if (companyId) {
          const { error } = await supabase
            .from("subscription_records")
            .update({
              subscription_status: "active",
              plan_id: planId,
              is_founding: isFounding,
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscriptionId ?? null,
              current_period_end: currentPeriodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", companyId);
          if (error) console.error("subscription_records update failed:", error);

          // Flip the company gate to active so the user can access the app.
          const { error: companyErr } = await supabase
            .from("companies")
            .update({ onboarding_status: "active" })
            .eq("id", companyId);
          if (companyErr) console.error("companies status flip failed:", companyErr);

          await supabase.from("onboarding_events").insert({
            company_id: companyId,
            event_type: "payment_completed",
            details: {
              stripe_customer_id: customerId ?? null,
              stripe_subscription_id: subscriptionId ?? null,
            },
          });
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const companyId = sub.metadata?.company_id;
        const planId = sub.metadata?.plan_id ?? undefined;
        const isFounding = sub.metadata?.is_founding === "true";
        const update: Record<string, unknown> = {
          subscription_status: sub.status,
          current_period_end: new Date((sub.current_period_end ?? 0) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (planId) update.plan_id = planId;
        if (sub.metadata?.is_founding !== undefined) update.is_founding = isFounding;
        const query = supabase.from("subscription_records").update(update);
        const { error } = companyId
          ? await query.eq("company_id", companyId)
          : await query.eq("stripe_subscription_id", sub.id);
        if (error) console.error("subscription_records update failed:", error);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const companyId = sub.metadata?.company_id;
        const update = {
          subscription_status: "cancelled",
          updated_at: new Date().toISOString(),
        };
        const query = supabase.from("subscription_records").update(update);
        const { error } = companyId
          ? await query.eq("company_id", companyId)
          : await query.eq("stripe_subscription_id", sub.id);
        if (error) console.error("subscription_records cancel failed:", error);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
        if (subscriptionId) {
          const { error } = await supabase
            .from("subscription_records")
            .update({ subscription_status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subscriptionId);
          if (error) console.error("invoice.payment_failed update failed:", error);
        }
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
        return new Response(
          JSON.stringify({ error: `Unhandled event type: ${event.type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});