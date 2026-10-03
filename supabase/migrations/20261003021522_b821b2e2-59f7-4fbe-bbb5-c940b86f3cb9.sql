ALTER TABLE public.nemsis_cta_submissions
  ADD COLUMN IF NOT EXISTS total_error_count integer,
  ADD COLUMN IF NOT EXISTS validation_errors jsonb,
  ADD COLUMN IF NOT EXISTS sent_timestamp text;