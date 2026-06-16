
## Goal

Reorder the signup → approval → trial → payment flow so:

1. Sign up → wizard → introduction with **Product Tour tip cards** (existing per-page tours, no change)
2. **Pending approval** → creator reviews in their console
3. At approval, the creator picks **one of two paths** for that company:
   - **Standard (default): 30-day free trial, no card required.** Owner gets full app access; trial timer starts.
   - **Skip trial:** owner is sent straight to the payment options page on next login. No app access until they pay.
4. **Trial timer rules** (standard path only):
   - Starts at the **earlier of** (a) owner's first login after approval, or (b) approval time + 12 hours.
   - Counts down 30 days from that start.
   - At 0, login redirects to **payment options** (locked-at-login behavior).
5. Creator dashboard shows the trial countdown for every company that's currently in trial, plus "skipped trial / awaiting payment" and "paid" statuses.
6. After payment, the owner regains access at whatever plan they bought.

## Current vs. desired flow

```text
CURRENT
  signup → pending_approval → [creator approves]
    → approved_pending_payment → ChoosePlan (card required upfront)
    → Stripe checkout → app access (with a 30-day "not charged" window)

DESIRED
  signup → pending_approval → [creator approves, picks Standard or Skip Trial]
    Standard:
      → onboarding wizard + app access (trial active, no card)
      → trial_started_at set on first login OR approval+12h, whichever first
      → 30 days later: trial_expired → locked at login → ChoosePlan → Stripe → active
    Skip Trial:
      → next login redirects to ChoosePlan → Stripe → active (no trial, no wizard gate)
```

## Database changes (one migration)

Add to `subscription_records`:
- `trial_skipped` boolean default false — set by creator at approval.
- `trial_started_at` timestamptz nullable — set on first login OR by a server-side "approval + 12h" sweep.
- `approval_grace_deadline` timestamptz nullable — = approved_at + 12h. Used by the sweep to auto-start the timer.

Computed in code (not stored):
- Effective trial end = `trial_started_at + 30 days` (replaces the current "trial_ends_at = signup + 30d" seeding).

Migration also:
- Backfills existing rows: `trial_started_at = created_at`, `approval_grace_deadline = created_at + interval '12 hours'` so existing companies keep working.
- Adds index on `(subscription_status, trial_started_at)` for the creator countdown query.

## Edge function changes

**`company-signup`**
- Stop pre-seeding `trial_ends_at`. Insert subscription as `pending` with no trial dates. The trial only begins after approval.

**`manage-company` (action = "approve")**
- Accept new optional body field `skip_trial: boolean`.
- If `skip_trial = true`:
  - `companies.onboarding_status = 'approved_pending_payment'` (existing status, reused).
  - `subscription_records.trial_skipped = true`, no trial dates.
- If `skip_trial = false` (default):
  - `companies.onboarding_status = 'active'` (gives app access immediately).
  - `subscription_records.subscription_status = 'TRIAL_PENDING_START'`, `approval_grace_deadline = now() + 12h`, `trial_started_at = null`.

**New small edge function `start-trial-timer-if-needed`** (called by `useAuth` on login)
- For the active company: if status is `TRIAL_PENDING_START` and `trial_started_at` is null, set `trial_started_at = now()`, `subscription_status = 'TRIAL_ACTIVE'`.
- Idempotent — safe to call on every login.

**New scheduled function `sweep-approval-grace`** (cron, hourly)
- For any subscription with `trial_started_at IS NULL` and `approval_grace_deadline < now()`, set `trial_started_at = approval_grace_deadline` and `subscription_status = 'TRIAL_ACTIVE'`. Handles owners who never log in.

**`create-checkout-session` / `stripe-webhook`** (no Stripe API contract change needed)
- Already takes plan + cycle and returns a Stripe Checkout URL. Keep as-is.
- Webhook on `checkout.session.completed`: set `subscription_status = 'ACTIVE'`, clear trial fields, set `onboarding_status = 'active'` (covers the skip-trial users who were `approved_pending_payment`).

## Front-end changes

**`useAuth.tsx`**
- Update the "effective status" computation:
  - Pull `trial_started_at`, `trial_skipped` in addition to `trial_ends_at`.
  - If `trial_skipped` → effective status is `approved_pending_payment` (sends user to `/choose-plan` on login).
  - If `trial_started_at` is set and `trial_started_at + 30d` is past → `trial_expired`.
  - On every authenticated session resolve, fire-and-forget call `start-trial-timer-if-needed`.

**`App.tsx` routing**
- `approved_pending_payment` → force redirect to `/choose-plan` (skip-trial users).
- `trial_expired` → keep current redirect to `/trial-expired` which already routes to `/choose-plan`.
- `active` with `TRIAL_ACTIVE` → full app, show `TrialBanner` countdown (already exists).

**`TrialBanner.tsx`**
- Switch the countdown source from `trial_ends_at` to `trial_started_at + 30d`. Hide if `trial_started_at` is null.

**Creator approval UI** (`CompanyVerificationPanel.tsx` and/or `CreatorCompanyDetail.tsx`)
- Add a toggle in the approve confirmation dialog: **"Skip 30-day trial — require payment before access"** (default OFF).
- Pass `skip_trial` in the `manage-company` invoke body.

**New creator panel: Trial Countdown table** (added to `SystemCreatorDashboard.tsx`)
- Columns: Company, Approved at, Trial status (Pending start / Active / Expired / Skipped / Paid), Days left, Owner email.
- Color-coded days left (green > 7, yellow 1–7, red ≤ 0).
- Auto-refreshes every 60s.

**`ChoosePlan.tsx`**
- Remove "Card on file required, not charged for 30 days" copy — the trial is now app-side, not Stripe-side. The page now exists strictly to take payment.
- No Stripe API change; just wording.

## Stripe reconciliation

Current Stripe usage has no built-in trial — `create-checkout-session` and the webhook already treat the 30-day window as an app-side concept. No Stripe object changes are needed. The only Stripe-relevant wording change is on `ChoosePlan.tsx` (no longer says "not charged for 30 days").

## Files touched

- New migration under `supabase/migrations/`
- `supabase/functions/company-signup/index.ts` (stop seeding trial dates)
- `supabase/functions/manage-company/index.ts` (skip_trial branch in approve)
- `supabase/functions/start-trial-timer-if-needed/index.ts` (new)
- `supabase/functions/sweep-approval-grace/index.ts` (new, cron)
- `supabase/functions/stripe-webhook/index.ts` (clear trial fields on payment)
- `src/hooks/useAuth.tsx`
- `src/App.tsx` (routing for `approved_pending_payment`)
- `src/components/onboarding/TrialBanner.tsx`
- `src/components/creator/CompanyVerificationPanel.tsx` (skip-trial toggle)
- `src/pages/SystemCreatorDashboard.tsx` (countdown table) — or a new `src/components/creator/TrialCountdownPanel.tsx`
- `src/pages/ChoosePlan.tsx` (copy tweak)

## Out of scope for this plan

- Promo / founding pricing logic (already exists, untouched).
- Per-page Product Tour content (already the "tip cards", no change).
- Email template wording beyond the approval email's existing "you're approved" copy — can be polished in a follow-up.
