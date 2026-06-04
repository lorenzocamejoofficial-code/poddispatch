## Pricing model

Three Stripe prices:
1. **Founding** — $799/mo, lifetime (auto-applied to paid customers #1–5)
2. **Starter** — $799/mo (1–5 trucks)
3. **Pro** — $1,500/mo (6+ trucks)

Trial: 30 days, no card collected. App hard-locks on day 31 until checkout completes.

## What gets built

### 1. Stripe product setup (you do this once in Stripe dashboard)
- Create three recurring prices, add their IDs as secrets:
  - `STRIPE_PRICE_FOUNDING` (already exists)
  - `STRIPE_PRICE_STARTER`
  - `STRIPE_PRICE_PRO`

### 2. Signup stays the same
No card at signup. `subscription_records.subscription_status = 'trial'`, `trial_ends_at = now + 30d`, `plan_id = null` (tier picked at checkout).

### 3. Trial countdown + lock
- `TrialBanner` shows "X days left in trial" on every admin page.
- New edge function `check-trial-status` (or DB check in existing auth flow): if `trial_ends_at < now()` and status still `trial`, flip to `trial_expired`.
- Existing `TrialExpired.tsx` page already locks the app — wire it to redirect when status = `trial_expired`.

### 4. Pick-your-tier checkout page
New `/choose-plan` page shown when:
- User clicks "Upgrade" in trial banner, OR
- Trial expired and they hit the lock page

Shows two cards: Starter $799 (1–5 trucks) and Pro $1,500 (6+ trucks). Clicking either calls `create-checkout-session` with the chosen tier.

### 5. Founding auto-assignment (server-side)
`create-checkout-session` updated:
- Count distinct `companies` where `subscription_records.subscription_status = 'active'` (paying).
- If count < 5 → swap the line item to `STRIPE_PRICE_FOUNDING` regardless of tier chosen, and stamp `subscription_records.is_founding = true`.
- Else use Starter/Pro price the user picked.
- Race-safe via a `SELECT ... FOR UPDATE` on a singleton `founding_counter` row.

### 6. Stripe webhook (`stripe-webhook`) updates
On `checkout.session.completed` / `customer.subscription.updated`:
- Set `subscription_status = 'active'`, store `plan_id` (`founding` | `starter` | `pro`), `stripe_subscription_id`, `current_period_end`.
- On `customer.subscription.deleted` / `invoice.payment_failed` → `past_due` or `cancelled`.

### 7. Truck cap enforcement (Starter → Pro upgrade gate)
- New DB trigger on `trucks` insert: if active truck count would exceed plan cap (Starter = 5, Founding = unlimited grandfathered, Pro = unlimited), raise exception.
- UI: when blocked, show modal "Starter includes 5 trucks. Upgrade to Pro to add more." → button opens Stripe customer portal subscription change.

### 8. Creator dashboard visibility
Update `CompanyHealthTable`:
- New **Plan** column: `Trial Day 12/30` · `Founding` · `Starter` · `Pro` · `Expired` · `Past due` (color-coded badges)
- New **MRR** column ($799 / $1,500)
- New **Next renewal / Trial ends** column
- Filter dropdown: All / Trial / Trial ending ≤7d / Paying / Expired / Past due
- Footer totals: total MRR, # trials, # paying, founding seats remaining (5 − count)

### 9. Clean slate for existing accounts
Single SQL migration deletes all non-creator companies (you confirmed only your creator account exists). Your creator tenant is untouched.

## Schema changes
```text
subscription_records:
  + is_founding boolean default false
  + stripe_subscription_id text
  + stripe_customer_id text
  + current_period_end timestamptz
  + plan_id changed to text ('trial'|'founding'|'starter'|'pro')

new table: founding_counter (single row, paid_count int)
```

## Out of scope for this pass
- Annual pricing (skipped — you didn't ask)
- Dunning emails beyond Stripe defaults
- Proration on mid-cycle upgrades (Stripe handles automatically)

## Order of operations
1. Migration (schema + clean slate + founding counter)
2. Update `create-checkout-session` (auto-founding logic + tier param)
3. Update `stripe-webhook` (write new fields)
4. Build `/choose-plan` page
5. Wire `TrialBanner` + `TrialExpired` redirect
6. Truck cap trigger + upgrade modal
7. Creator dashboard columns

After approval I'll need you to: (a) create the two new Stripe prices and paste their IDs into secrets, (b) confirm you're OK deleting all non-creator company rows.