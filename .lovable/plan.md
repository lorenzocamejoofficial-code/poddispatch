# Trial Lifecycle Audit (read-only) — Pass 1 ground truth

No code or data was changed. Approving this card does nothing by itself; it only records the findings.

## 1. Where trial state lives
Table `public.subscription_records` (one row per company):
- `subscription_status` — values seen in code: `trial_pending_start`, `trial`, `trial_active`, `TEST_ACTIVE`, `trial_expired`, `active`, `past_due`, `pending_cancellation`, `cancelled`.
- `trial_started_at`, `trial_ends_at`, `trial_expired_at`, `trial_skipped`, `approval_grace_deadline`, `is_comped`, `comped_reason`, `is_founding`.

Writers:
- `supabase/functions/manage-company` — approval sets `approval_grace_deadline = now + 7d`, nulls trial dates; `extend_trial`, `comp_activate`, `revert_comp`.
- `supabase/functions/start-trial-timer-if-needed` — first login: writes `trial_started_at`, `trial_ends_at = +30d`, status `trial_active`.
- `supabase/functions/sweep-approval-grace` — owner never logged in: starts trial at grace deadline, `+30d`.
- `supabase/functions/sweep-trial-expiry` — writes `trial_expired` + `trial_expired_at`; backfills missing `trial_ends_at`.
- `supabase/functions/stripe-webhook` — on paid conversion nulls trial dates.
- Migrations `20260616024534` (backfilled `trial_started_at`) and `20260922222347` (added `trial_expired_at`/`is_comped`, backfilled `trial_ends_at` only where missing).

Readers: `src/hooks/useAuth.tsx`, `src/components/onboarding/TrialBanner.tsx`, `src/pages/CreatorCompanyDetail.tsx`, `src/components/creator/CompanyHealthTable.tsx`, `src/components/creator/TrialCountdownPanel.tsx`, `src/components/billing/SubscriptionPanel.tsx`, `supabase/functions/create-checkout-session`, `cancel-subscription`.

Current data: 2 rows. One `trial_expired` (founding, with dates and `trial_expired_at` set), one `cancelled`.

## 2. Trial clock
Shared helper `src/lib/trial-window.ts` (`TRIAL_LENGTH_DAYS = 30`; prefers `trial_ends_at`, falls back to start + 30). Used by useAuth, TrialBanner, CreatorCompanyDetail, CompanyHealthTable, TrialCountdownPanel.

Places that calculate it on their own, all using 30 days:
- `sweep-trial-expiry` (`TRIAL_LENGTH_MS`), `sweep-approval-grace`, `start-trial-timer-if-needed`, `manage-company` extend fallback, `create-checkout-session` (rounds days left up from `trial_ends_at`).

The "7" you saw is not a trial length. It is the 7-day approval grace period before the trial clock is force-started, plus the 7-day "Expiring Soon" color cutoff.

Inconsistencies found:
- **TrialCountdownPanel does not select `trial_ends_at`**, so it always shows start + 30 days and **ignores creator extensions**. The other surfaces show the extended date.
- CompanyHealthTable clamps negative days to 0; TrialBanner shows a real "Trial ended" state instead. Display only.
- TrialBanner and useAuth treat `trial_pending_start` as a trial; the sweep does not, which is correct because there is no clock yet.
- The 30-day value is written out in 5 server functions, not imported from one place. Today they all say 30.

## 3. Expiry handling
Both happen. useAuth works out expiry on every load as a backstop, and an hourly scheduled job (`sweep-trial-expiry-hourly`, at :15) saves the expiry to the database. `sweep-approval-grace-hourly` runs at :00.
- Login: both functions only accept the service role key or the `x-cron-secret` header that matches `CRON_SHARED_SECRET`; any other request is refused with 401. `verify_jwt = false` in config, so the function itself does the auth check.
- Issue: the scheduled job's database command contains **the secret value in plain text** (same value for `check-cert-expirations`). Users can't see it, but anyone with database read access can. A safer setup would read it from the vault instead.
- Comped companies are skipped. The sweep only touches trial statuses and is safe to run more than once.

## 4. What a user sees after the trial expires
`src/App.tsx:335` — non-creators with status `trial_expired` can only reach `/trial-expired` and `/choose-plan`; every other page sends them to `/trial-expired`.
- `TrialExpired.tsx`: founding companies see their $799 rate and a "Continue" button that goes to `/choose-plan`. Others see "Choose a Plan". Sign Out is available.
- `ChoosePlan.tsx` reads `is_founding`; `create-checkout-session` forces the founding price for granted founding companies.
- No deadlock found in the code: an expired user can always get to checkout. Not checked: an actual Stripe checkout end-to-end, and whether an expired trial gets a 1-day Stripe trial from `max(1, daysLeft)` in checkout.
- Note: only owners and creators see the banner. When a company's trial expires, dispatchers and crew members are also sent to TrialExpired, and they can't pay.

## 5. Creator controls
`CreatorCompanyDetail.tsx` → `manage-company`:
- `extend_trial` — reason required; blocked for paying or comped companies; extends from the current end date; records `admin_actions` (before snapshot) and an `onboarding_events` row.
- `comp_activate` / `revert_comp` — recorded in `admin_actions`.
- Founding grant/revoke is a separate creator-only action that is also recorded.
- Approval sets the grace deadline. There is no separate "activate without comp" lever.

## 6. Gaps vs the Pass 1 goal
Most of Pass 1 already exists: dates are saved, the expiry sweep exists, its login check works and it runs on a schedule. Remaining gaps:
1. TrialCountdownPanel ignores `trial_ends_at`, so extensions don't show there.
2. Trial length is repeated in 5 server functions instead of one shared server-side constant.
3. The scheduled jobs store the shared secret in plain text; it should be read from the vault.
4. Status names aren't consistent (`trial` / `trial_active` / `TEST_ACTIVE`), and different code paths use different lists.
5. CompanyHealthTable's clamp to 0 differs from TrialBanner's "ended" state (display only).
6. Dispatcher and crew users get the payment screen when the trial expires; they need a "contact your owner" message.
7. Not checked: real Stripe checkout from an expired founding trial, and the 1-day minimum trial in checkout.

## Files reviewed
src/lib/trial-window.ts, src/hooks/useAuth.tsx, src/App.tsx, src/components/onboarding/TrialBanner.tsx, src/pages/TrialExpired.tsx, src/pages/ChoosePlan.tsx, src/pages/CreatorCompanyDetail.tsx, src/components/creator/CompanyHealthTable.tsx, src/components/creator/TrialCountdownPanel.tsx, src/components/billing/SubscriptionPanel.tsx, supabase/functions/{sweep-trial-expiry, sweep-approval-grace, start-trial-timer-if-needed, manage-company, create-checkout-session, stripe-webhook, cancel-subscription}, supabase/config.toml, migrations 20260616024534 and 20260922222347, cron.job, subscription_records.
