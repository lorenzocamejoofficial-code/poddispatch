
-- Add needs_review to claim_status enum
ALTER TYPE public.claim_status ADD VALUE IF NOT EXISTS 'needs_review';

-- Add new columns to claim_records
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS vehicle_id text,
  ADD COLUMN IF NOT EXISTS odometer_at_scene numeric,
  ADD COLUMN IF NOT EXISTS odometer_at_destination numeric,
  ADD COLUMN IF NOT EXISTS odometer_in_service numeric,
  ADD COLUMN IF NOT EXISTS stretcher_placement text,
  ADD COLUMN IF NOT EXISTS patient_mobility text,
  ADD COLUMN IF NOT EXISTS isolation_precautions jsonb;
