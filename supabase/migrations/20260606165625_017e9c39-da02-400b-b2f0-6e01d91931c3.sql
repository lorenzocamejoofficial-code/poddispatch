
ALTER TABLE public.subscription_records
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancel_feedback text,
  ADD COLUMN IF NOT EXISTS reactivation_deadline timestamptz;
