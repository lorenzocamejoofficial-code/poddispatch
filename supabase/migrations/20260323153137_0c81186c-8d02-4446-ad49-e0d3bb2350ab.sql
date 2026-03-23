-- Add new columns to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS odometer_at_scene numeric,
  ADD COLUMN IF NOT EXISTS odometer_at_destination numeric,
  ADD COLUMN IF NOT EXISTS odometer_in_service numeric,
  ADD COLUMN IF NOT EXISTS vehicle_id text,
  ADD COLUMN IF NOT EXISTS isolation_precautions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stretcher_placement text,
  ADD COLUMN IF NOT EXISTS patient_mobility text;

-- Migrate existing ift_discharge values to ift
UPDATE public.trip_records SET pcr_type = 'ift' WHERE pcr_type = 'ift_discharge';