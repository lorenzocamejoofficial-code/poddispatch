
-- Artifact table: one row per generated 837P file
CREATE TABLE public.claim_submission_artifacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  filename TEXT NOT NULL,
  edi_content TEXT NOT NULL,
  claim_ids UUID[] NOT NULL DEFAULT '{}',
  byte_size INTEGER NOT NULL DEFAULT 0,
  is_test_submission BOOLEAN NOT NULL DEFAULT false,
  generated_by UUID,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_csa_company ON public.claim_submission_artifacts(company_id, generated_at DESC);
CREATE INDEX idx_csa_claim_ids ON public.claim_submission_artifacts USING GIN(claim_ids);

ALTER TABLE public.claim_submission_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing roles can read company artifacts"
ON public.claim_submission_artifacts
FOR SELECT
USING (
  company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin() OR public.is_system_creator())
);

CREATE POLICY "Billing roles can insert artifacts for their company"
ON public.claim_submission_artifacts
FOR INSERT
WITH CHECK (
  company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin() OR public.is_system_creator())
);

-- Rejection capture columns on claim_records
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS last_rejection_raw TEXT,
  ADD COLUMN IF NOT EXISTS last_rejection_loop TEXT,
  ADD COLUMN IF NOT EXISTS last_rejection_segment TEXT,
  ADD COLUMN IF NOT EXISTS last_rejection_byte INTEGER,
  ADD COLUMN IF NOT EXISTS last_rejection_recorded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_rejection_recorded_by UUID,
  ADD COLUMN IF NOT EXISTS last_submission_artifact_id UUID REFERENCES public.claim_submission_artifacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claim_records_artifact ON public.claim_records(last_submission_artifact_id);
