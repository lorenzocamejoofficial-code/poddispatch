
-- Add emergency upgrade columns to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS emergency_upgrade_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_upgrade_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_upgrade_resolution text,
  ADD COLUMN IF NOT EXISTS emergency_upgrade_voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_upgrade_voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS emergency_upgrade_voided_by uuid,
  ADD COLUMN IF NOT EXISTS emergency_pcr_trip_id uuid REFERENCES public.trip_records(id),
  ADD COLUMN IF NOT EXISTS original_trip_id uuid REFERENCES public.trip_records(id),
  ADD COLUMN IF NOT EXISTS is_emergency_pcr boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_billing_recommendation text,
  ADD COLUMN IF NOT EXISTS emergency_billing_override text,
  ADD COLUMN IF NOT EXISTS emergency_billing_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS emergency_billing_reviewed_at timestamptz;

-- Add emergency event columns to claim_records
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS has_emergency_event boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS emergency_event_summary text,
  ADD COLUMN IF NOT EXISTS emergency_billing_recommendation text,
  ADD COLUMN IF NOT EXISTS emergency_billing_override text,
  ADD COLUMN IF NOT EXISTS emergency_billing_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS emergency_billing_reviewed_at timestamptz;
