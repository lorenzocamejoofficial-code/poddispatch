ALTER TABLE public.subscription_records
  ADD COLUMN IF NOT EXISTS trial_expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_comped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comped_at timestamptz,
  ADD COLUMN IF NOT EXISTS comped_by uuid,
  ADD COLUMN IF NOT EXISTS comped_reason text;

UPDATE public.subscription_records
SET trial_ends_at = trial_started_at + interval '30 days'
WHERE trial_ends_at IS NULL AND trial_started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_records_trial_ends_at
  ON public.subscription_records (subscription_status, trial_ends_at);