# Creator-granted Founding + plan name fix

Two changes: let you hand a founding rate to a customer you close yourself, and stop paying customers from being wrongly limited to 5 trucks.

## Change 1 — Grant Founding from the Company Console

**Where:** the company detail page where the approval controls and the "Founding Member" badge already live (`src/pages/CreatorCompanyDetail.tsx`, subscription card around line 231-240).

**What you see:** a "Founding rate" row showing either the Founding Member badge or a "Grant founding rate" button, plus a live "X of 5 founding slots remaining" line. The button opens a short confirm dialog naming the company and the locked price.

**Rules enforced server-side** (new `grant_founding` action inside the existing creator-only `manage-company` function, so the existing creator check and audit logging are reused):
- Already founding → returns success, changes nothing, no slot consumed (idempotent).
- Not founding → calls the same `try_claim_founding_slot()` used by self-serve checkout. The counter is the only source of truth, so the 5-slot cap can never be exceeded.
- Slot claim returns false → refuses with "0 founding slots remaining" and nothing is written.
- On success: sets `is_founding = true` and writes the real founding amount into `monthly_amount_cents` (79900) so your MRR figures stop reporting the stale $599 default.
- Every grant is written to `admin_actions` like other creator actions.

**How the $799 actually sticks:** no new Stripe price, and no new locked-rate field. The customer still goes through normal checkout; `create-checkout-session` gains one check before its founding logic — if the company's `subscription_records.is_founding` is already true, it uses `STRIPE_PRICE_FOUNDING` directly and does **not** claim another slot (their slot was already consumed at grant time). The founding price is what Stripe charges, so the rate is real, not cosmetic. The current auto-swap for the first five self-serve monthly Starter checkouts stays exactly as-is.

This is the cleanest path: one flag drives the badge, the truck cap, and the price, and the slot counter stays the single atomic gate.

## Change 2 — Plan names the truck cap understands

Current writers:
- `company-signup` stamps every new company `plan_id: "poddispatch_standard"` — a value the cap rule does not recognise, so it falls into the unknown branch and caps at 5 trucks.
- `create-checkout-session` puts `starter` / `pro` / `founding` in the Stripe metadata; `stripe-webhook` copies that onto the row after payment. Those are already correct.

Canonical set: `trial`, `starter`, `pro`, `founding`.

- Signup writes `trial` instead of `poddispatch_standard`. Same cap behaviour as today for unpaid companies (5 trucks) but now by design rather than by accident.
- The cap rule is extended to treat `founding` as unlimited by name as well as by flag, so a founding row is never capped whichever path set it.
- After payment the webhook lands `pro` for a Pro customer, which the rule already treats as unlimited. So a paying Pro customer is no longer stuck at 5.
- Sandbox and creator-test companies keep their existing exemptions; simulated trucks still skip the rule entirely.

**Existing data (report only, no change made):** two subscription rows exist, both stamped `poddispatch_standard` — one cancelled, one on trial. Neither is a paying Pro customer, so neither is being wrongly capped today. A one-time rename to `trial` would be tidy; tell me if you want it and I'll include it.

## Not touched

Trial length and timers, claims/837, denial recovery, tenant isolation and RLS policies, and live Stripe price objects. The only Stripe change is which existing price ID is selected at checkout.

## Technical notes

- `manage-company/index.ts`: new `grant_founding` action after the creator gate; calls `try_claim_founding_slot()` via the service client; returns `{ granted, slots_remaining, already_founding }`.
- New read used by the UI: remaining slots from `founding_counter` (creator-only).
- `create-checkout-session/index.ts`: pre-set `is_founding` short-circuits the slot claim and forces `STRIPE_PRICE_FOUNDING`.
- Migration: replace `enforce_truck_plan_cap()` body to add `'founding'` to the unlimited branch. No table or policy changes.
- `company-signup/index.ts`: `plan_id: "trial"`.
