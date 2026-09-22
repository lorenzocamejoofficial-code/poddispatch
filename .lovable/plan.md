# Company lifecycle fix: one trial clock, real expiry, creator levers, no founding dead end

Goal: the trial date stored in the database, the countdown the owner sees, and the screen they get at login all agree — and you (the creator) can extend a trial or switch a company on without Stripe. A founding customer can never end up locked out with no way forward.

## Recommended order (4 passes)

Order is driven by coupling: the stored end date must exist before anything can trust it; the shared clock must exist before the gate and the panels use it; only then is it safe to add levers and remove the dead end.

### Pass 1 — Make the stored trial date real (database + scheduled job)

1. Migration on `subscription_records`: add `trial_expired_at timestamptz`, and a trigger/`updated_at` touch if not already present. No column drops.
2. Backfill: for every row with `trial_started_at` set and `trial_ends_at` NULL, set `trial_ends_at = trial_started_at + 30 days`. Fixes Test Ambulance's permanently blank date.
3. Every place that starts a trial now writes both dates together:
   - `start-trial-timer-if-needed` (first login)
   - `sweep-approval-grace` (grace deadline force-start)
   - the approve path in `manage-company`
4. New scheduled function `sweep-trial-expiry` (hourly): any row with a trial status whose `trial_ends_at` is in the past gets `subscription_status = 'trial_expired'`, `trial_expired_at = now()`, plus a `subscription_status_history` row and an `onboarding_events` entry. Idempotent — it only touches rows not already expired. Founding rows are expired the same way (status only; founding flag, price and truck cap untouched).
5. Fix the two 401 crons: jobs 4 and 5 currently post with only the public API key, which those functions reject. Reschedule them (via run_sql, since the URL/keys are project-specific) to also send `x-cron-secret: <CRON_SHARED_SECRET>`, and schedule the new expiry sweep the same way. If that secret isn't set yet I'll generate it and bind it.

Verify: open the creator console — Test Ambulance shows a real trial end date instead of "No trial", and after the sweep runs its status reads expired rather than `trial_active`.

### Pass 2 — One clock everywhere (UI only)

`src/hooks/useAuth.tsx` currently computes expiry inline with the opposite precedence to `src/lib/trial-window.ts`, and `CreatorCompanyDetail` uses neither.

- `useAuth` drops its inline math and calls `isTrialExpired()` from `trial-window.ts`. Same helper, same precedence (`trial_ends_at` first, then `trial_started_at + 30`), everywhere.
- `CreatorCompanyDetail` uses `trialDaysLeft()` / `resolveTrialEnd()` instead of reading the column raw.
- The login gate keeps computing too, so it stays correct between hourly sweeps — but since both read the same stored end date, computed and persisted can no longer disagree: the sweep only persists what the shared helper already says.
- `TrialBanner`: stop clamping at 0 and stop saying "Active Trial" past the end — expired shows an expired state with the action to take.

Verify: a company's days-left reads identically on the owner banner, the creator Trial Countdown panel, the company health table, and the company detail page.

### Pass 3 — Creator levers (edge function + creator UI)

Two new creator-only actions in `manage-company` (same `requireSystemCreator` gate every other action uses), each writing an `admin_actions`/audit row and a `subscription_status_history` row:

- **Extend trial** — creator picks days; pushes `trial_ends_at` out, clears `trial_expired_at`, restores status to `trial_active`. Reason required.
- **Activate (comp)** — sets `subscription_status = 'active'` with a `comped` marker and the creator's reason. It does **not** create a Stripe customer, subscription, or charge, and writes no fake Stripe ids. Comped companies are visibly labelled "Comped (no Stripe)" in the creator console and metrics so revenue numbers stay honest.
- Optional counterpart **Revert comp** back to trial/expired so it isn't one-way.

Founding stays untouched by both: neither action can set or clear founding, change the $799 rate, or alter the truck cap — only the existing grant/revoke does that.

Verify: on Test Ambulance, click Extend trial 14 days → banner and creator panels show 14 days and the owner is no longer redirected. Click Activate (comp) → owner lands in the app normally, creator console shows Comped, and no Stripe object exists.

### Pass 4 — Close the founding dead end (UI)

Today an expired founding company is redirected to `/trial-expired` → "Choose a Plan" → ChoosePlan hides checkout for founding → nowhere to go.

Fix, belt and braces:

1. ChoosePlan stops being a dead end for founding: instead of hiding everything, founding companies see their locked $799 founding rate and a working checkout that can only ever create the founding-priced subscription. The existing server-side override that forces founding pricing stays exactly as is — so this cannot become a way to lose the founding rate.
2. `/trial-expired` renders a founding-specific state: their locked rate, the founding checkout button, and a direct "contact the team" path.
3. Pass 3's comp action gives you a manual unlock for any customer, founding or not.

Guarantee: after this, an expired founding company has at least two exits (own checkout at founding price, creator comp) and the screen never shows an action that leads nowhere. I'll verify by putting a founding test company past expiry and walking the path.

## What changes where

| Pass | Database | Edge functions | UI |
| --- | --- | --- | --- |
| 1 | new column, backfill, cron rescheduling | start-trial-timer, sweep-approval-grace, manage-company approve, new sweep-trial-expiry | — |
| 2 | — | — | useAuth, trial-window consumers, TrialBanner, CreatorCompanyDetail |
| 3 | history rows only | manage-company (2–3 actions) | CreatorCompanyDetail controls |
| 4 | — | — | ChoosePlan, TrialExpired |

## Not touched

Founding grant/revoke logic and pricing, claims/837, denial recovery, RLS and tenant isolation, Stripe price objects, subscription-update/customer-reuse rework.

## After each pass

Typecheck, full test run (plus new tests for the shared clock and the sweep's idempotency), and the click-throughs listed under each pass.
