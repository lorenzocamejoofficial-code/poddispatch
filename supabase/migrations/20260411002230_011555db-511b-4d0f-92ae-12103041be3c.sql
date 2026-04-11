ALTER TABLE public.migration_settings
  ADD COLUMN IF NOT EXISTS step_0_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_1_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_2_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_3_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_4_skipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS step_5_skipped boolean NOT NULL DEFAULT false;