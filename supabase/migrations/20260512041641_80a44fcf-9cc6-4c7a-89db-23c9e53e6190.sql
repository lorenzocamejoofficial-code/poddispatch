
-- 1. Extend claim_records with acknowledgment columns
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS acknowledgment_status text,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_codes text[],
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Soft enum check
ALTER TABLE public.claim_records
  DROP CONSTRAINT IF EXISTS claim_records_acknowledgment_status_check;
ALTER TABLE public.claim_records
  ADD CONSTRAINT claim_records_acknowledgment_status_check
  CHECK (acknowledgment_status IS NULL OR acknowledgment_status IN (
    'accepted_999','rejected_999','accepted_277ca','rejected_277ca','forwarded_to_payer'
  ));

-- 2. clearinghouse_ack_files
CREATE TABLE IF NOT EXISTS public.clearinghouse_ack_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL UNIQUE,
  file_type text NOT NULL CHECK (file_type IN ('999','277ca','277ca_summary')),
  source_file_id text,                -- e.g. FILEID portion from filename
  submitted_filename text,            -- the original 837P filename, parsed from filename
  raw_content text NOT NULL,
  parsed_summary jsonb DEFAULT '{}'::jsonb,
  claims_matched int NOT NULL DEFAULT 0,
  claims_updated int NOT NULL DEFAULT 0,
  unmatched_count int NOT NULL DEFAULT 0,
  parse_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ack_files_file_type ON public.clearinghouse_ack_files(file_type);
CREATE INDEX IF NOT EXISTS idx_ack_files_received_at ON public.clearinghouse_ack_files(received_at DESC);

ALTER TABLE public.clearinghouse_ack_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators view ack files" ON public.clearinghouse_ack_files;
CREATE POLICY "Creators view ack files" ON public.clearinghouse_ack_files
  FOR SELECT USING (public.is_system_creator());

-- 3. claim_acknowledgments — per-claim audit trail
CREATE TABLE IF NOT EXISTS public.claim_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_record_id uuid REFERENCES public.claim_records(id) ON DELETE CASCADE,
  ack_file_id uuid REFERENCES public.clearinghouse_ack_files(id) ON DELETE SET NULL,
  company_id uuid,
  file_type text NOT NULL CHECK (file_type IN ('999','277ca')),
  outcome text NOT NULL CHECK (outcome IN ('accepted','rejected','forwarded')),
  patient_control_number text,
  payer_claim_control_number text,
  rejection_codes text[],
  rejection_reason text,
  raw_segment text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_acks_claim ON public.claim_acknowledgments(claim_record_id);
CREATE INDEX IF NOT EXISTS idx_claim_acks_company ON public.claim_acknowledgments(company_id);
CREATE INDEX IF NOT EXISTS idx_claim_acks_outcome ON public.claim_acknowledgments(outcome);

ALTER TABLE public.claim_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company billing views claim acks" ON public.claim_acknowledgments;
CREATE POLICY "Company billing views claim acks" ON public.claim_acknowledgments
  FOR SELECT USING (
    public.is_system_creator()
    OR (company_id = public.get_my_company_id() AND (public.is_billing() OR public.is_admin()))
  );

-- 4. Quarantine extension for ack files
ALTER TABLE public.remittance_quarantine
  ADD COLUMN IF NOT EXISTS file_type text NOT NULL DEFAULT '835';
ALTER TABLE public.remittance_quarantine
  DROP CONSTRAINT IF EXISTS remittance_quarantine_file_type_check;
ALTER TABLE public.remittance_quarantine
  ADD CONSTRAINT remittance_quarantine_file_type_check
  CHECK (file_type IN ('835','999','277ca'));
