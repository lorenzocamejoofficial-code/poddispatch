ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS airway_json jsonb,
  ADD COLUMN IF NOT EXISTS procedures_json jsonb,
  ADD COLUMN IF NOT EXISTS medications_json jsonb,
  ADD COLUMN IF NOT EXISTS iv_access_json jsonb;