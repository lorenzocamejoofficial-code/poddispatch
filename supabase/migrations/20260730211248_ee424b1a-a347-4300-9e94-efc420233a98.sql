ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS tracking_curfew_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tracking_curfew_time time NOT NULL DEFAULT '21:00';