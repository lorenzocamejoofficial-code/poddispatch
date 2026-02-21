
-- Add vitals and transport condition columns to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS blood_pressure text,
  ADD COLUMN IF NOT EXISTS heart_rate integer,
  ADD COLUMN IF NOT EXISTS oxygen_saturation integer,
  ADD COLUMN IF NOT EXISTS respiration_rate integer,
  ADD COLUMN IF NOT EXISTS vitals_taken_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stretcher_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS general_weakness boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS esrd_dialysis boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fall_risk boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobility_method text,
  ADD COLUMN IF NOT EXISTS crew_names text,
  ADD COLUMN IF NOT EXISTS documentation_complete boolean DEFAULT false;
