
-- Migration 1: claim_records enhancements
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS allowed_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS adjustment_codes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS clearinghouse_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clearinghouse_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edi_acknowledgment_code text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payer_claim_control_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS secondary_claim_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS secondary_claim_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resubmission_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_claim_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS remittance_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS write_off_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_responsibility_amount numeric DEFAULT NULL;

-- Self-referencing foreign keys
ALTER TABLE public.claim_records
  ADD CONSTRAINT claim_records_secondary_claim_id_fkey
    FOREIGN KEY (secondary_claim_id) REFERENCES public.claim_records(id),
  ADD CONSTRAINT claim_records_original_claim_id_fkey
    FOREIGN KEY (original_claim_id) REFERENCES public.claim_records(id);
