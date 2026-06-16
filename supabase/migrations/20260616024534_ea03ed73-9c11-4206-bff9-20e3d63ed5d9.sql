
ALTER TABLE public.subscription_records
  ADD COLUMN IF NOT EXISTS trial_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_grace_deadline timestamptz;

-- Backfill: treat existing companies as having already started their trial at creation
UPDATE public.subscription_records
SET trial_started_at = COALESCE(trial_started_at, created_at),
    approval_grace_deadline = COALESCE(approval_grace_deadline, created_at + interval '12 hours')
WHERE trial_started_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_records_trial_lookup
  ON public.subscription_records (subscription_status, trial_started_at);
