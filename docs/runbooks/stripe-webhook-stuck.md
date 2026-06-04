# Stripe Webhook Stuck

**Symptom:** A customer paid in Stripe Checkout but the company's
`subscription_records.subscription_status` is still `incomplete` or
`payment_pending`. They can see the charge on their card but the app shows
"awaiting payment".

## Quick check (≤2 min)

1. Open the Creator Console → **System Health** tab. If `stripe` is `down`,
   that's the issue — the API key is bad or revoked. Fix the secret first.
2. In Stripe Dashboard → Developers → Webhooks → your endpoint → **Recent
   deliveries**. Look for `checkout.session.completed` / `customer.subscription.updated`
   events with a non-2xx response.
3. If the deliveries are 401, `STRIPE_WEBHOOK_SECRET` doesn't match the
   signing secret Stripe is using for that endpoint.

## Fix

- **401/403 on every delivery:** copy the **Signing secret** from the
  Stripe webhook page (`whsec_...`), update `STRIPE_WEBHOOK_SECRET` in
  Lovable Cloud → Secrets, redeploy.
- **No deliveries at all:** the endpoint URL is missing or wrong. It must
  be `https://slyxmgoonugqsnubdrqi.supabase.co/functions/v1/stripe-webhook`.
  Add it in Stripe Dashboard → Webhooks → "Add endpoint" with events
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- **2xx but state didn't flip:** check `supabase edge function logs` for
  `stripe-webhook`. Most common cause: the `customer.metadata.company_id`
  is missing on the Stripe customer. Patch it manually in Stripe, then
  resend the event from the dashboard.

## Verify

- Resend the failed event from Stripe Dashboard → Webhooks → click the
  event → **Resend**. Endpoint should return 200 and the company's
  `subscription_status` should flip to `active` within seconds.