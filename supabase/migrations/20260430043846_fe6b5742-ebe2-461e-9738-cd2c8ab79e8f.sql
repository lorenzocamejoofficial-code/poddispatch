
CREATE TABLE public.remittance_quarantine (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remittance_file_id UUID REFERENCES public.remittance_files(id) ON DELETE SET NULL,
  importing_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  matched_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  patient_control_number TEXT,
  payer_claim_control_number TEXT,
  billing_npi_in_file TEXT,
  expected_billing_npi TEXT,
  paid_amount NUMERIC(10,2) DEFAULT 0,
  patient_responsibility NUMERIC(10,2) DEFAULT 0,
  claim_status_code TEXT,
  file_name TEXT,
  raw_clp_segment TEXT,
  quarantine_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  posted_to_claim_id UUID REFERENCES public.claim_records(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_remittance_quarantine_status ON public.remittance_quarantine(status);
CREATE INDEX idx_remittance_quarantine_importing_company ON public.remittance_quarantine(importing_company_id);
CREATE INDEX idx_remittance_quarantine_created ON public.remittance_quarantine(created_at DESC);

ALTER TABLE public.remittance_quarantine ENABLE ROW LEVEL SECURITY;

-- Only system creators can see / manage quarantine
CREATE POLICY "System creators can view all quarantine records"
ON public.remittance_quarantine FOR SELECT
TO authenticated
USING (public.is_system_creator());

CREATE POLICY "System creators can update quarantine records"
ON public.remittance_quarantine FOR UPDATE
TO authenticated
USING (public.is_system_creator())
WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators can delete quarantine records"
ON public.remittance_quarantine FOR DELETE
TO authenticated
USING (public.is_system_creator());

-- Service role (edge function) inserts; authenticated users cannot insert directly
CREATE POLICY "Service role can insert quarantine records"
ON public.remittance_quarantine FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE TRIGGER update_remittance_quarantine_updated_at
BEFORE UPDATE ON public.remittance_quarantine
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
