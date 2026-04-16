ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS pcs_physician_name text,
  ADD COLUMN IF NOT EXISTS pcs_physician_npi text,
  ADD COLUMN IF NOT EXISTS pcs_certification_date date,
  ADD COLUMN IF NOT EXISTS pcs_diagnosis text,
  ADD COLUMN IF NOT EXISTS pcs_completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS pcs_completed_by uuid;