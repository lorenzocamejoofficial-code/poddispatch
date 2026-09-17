# Founding-Rate Protection (Guards 1 + 2 only)

Make founding one-way: a founding customer can never lose founding status or the $799/mo lifetime rate via any Stripe event or UI path. Only the creator grant/revoke in manage-company can change it. The double-subscription / stripe.subscriptions.update / customer-reuse rework is explicitly NOT in this pass.

## Guard 1 — Founding customers never see upgrade checkout

**`src/pages/ChoosePlan.tsx`**
- On load, fetch `subscription_records.is_founding` for `activeCompanyId` (select on company_id, maybeSingle).
- If `is_founding === true`: render a locked state instead of the plan cards and cycle toggle:
  - Heading: "You're on the Founding rate"
  - Body: "Unlimited trucks · $799/mo locked for life. No plan change needed."
  - No checkout buttons, no plan cards, no "Continue with Starter/Pro."
  - Keep the Sign Out button.
- While the flag loads, show a small loading state (prevents a founding user catching a flash of checkout buttons).

**`src/pages/TrucksCrews.tsx`** — no change. Confirmed unreachable for founding: the truck-cap trigger (`supabase/migrations/20260913190741_...sql:26-27`) returns early when `is_founding` is true or plan is `pro`/`founding`, so `TRUCK_CAP_EXCEEDED` can never fire for a founding company, so the "Upgrade to Pro" toast at line 489-494 can never appear.

## Guard 2 — Webhook can never strip founding

**`supabase/functions/stripe-webhook/index.ts`**

Both `checkout.session.completed` (lines 69-128) and `customer.subscription.updated` (lines 130-160) get read-before-write protection:

1. **Read first.** Before updating, select the existing row: `select is_founding, plan_id from subscription_records` keyed by `company_id` (fall back to `stripe_subscription_id` for the updated event when metadata lacks company_id — same as today).
2. **Never strip founding.** If the existing row has `is_founding = true`:
   - Do not write `is_founding` at all (leave it true) — regardless of what the event metadata says.
   - Do not write `plan_id` — it stays `'founding'`.
   - Log `console.warn` noting stale non-founding metadata was ignored for a founding company.
3. **If the existing row is not founding**, behavior is unchanged (metadata drives `is_founding` / `plan_id` as today).
4. All other fields in both updates (status, stripe IDs, period end, trial-clearing fields, cancel flags) are written exactly as today.

Founding therefore becomes one-way in this function: only manage-company's grant/revoke can ever change `is_founding`.

**Minimal addition — write `monthly_amount_cents`:**
- Computed from the actual Stripe subscription price (already retrieved on checkout.session.completed; available on `sub.items.data[0].price` for subscription.updated), as a monthly-equivalent: `unit_amount / interval months` (month=1, year=12). This writes 79900 for the founding price and keeps yearly plans accurate (e.g. Starter yearly 799000/12).
- For a founding row, this yields 79900 because the founding checkout already uses the founding price — no special-casing needed beyond a comment.
- Fallback if the price can't be read: founding row → 79900; otherwise leave the field untouched (never zero it out).
- This is the only billing-adjacent write; no subscription creation/cancellation/proration logic is touched.

`customer.subscription.deleted` and `invoice.payment_failed` handlers: unchanged (neither writes `is_founding` or `plan_id`).

## Scope — NOT in

No `stripe.subscriptions.update`, no customer reuse, no cancel-old-subscription logic, no proration, no billing portal. No changes to pricing math, 837/claims, denial recovery, trial timers, RLS/tenant isolation, or manage-company's grant/revoke path.

## Technical notes

- Files: `src/pages/ChoosePlan.tsx`, `supabase/functions/stripe-webhook/index.ts` only.
- Founding amount constant: 79900 cents ($799/mo), matching manage-company/index.ts:851.
- `subscription_records.monthly_amount_cents` feeds CreatorCompanyDetail MRR (line 151) and SaaSMetricsTab — writing real values removes the stale-$599 fallback there.

## Verification

- Typecheck (`npx tsgo --noEmit -p tsconfig.app.json`), full test run (`bunx vitest run`), build.
- New webhook unit test (pure logic extracted or via handler simulation): founding row + non-founding checkout metadata → `is_founding` stays true, `plan_id` stays `founding`, `monthly_amount_cents` = 79900; non-founding row → unchanged behavior.
- Deploy the webhook edge function after build passes.
