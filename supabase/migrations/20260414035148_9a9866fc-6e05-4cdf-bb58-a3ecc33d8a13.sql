
-- Create payer_directory table
CREATE TABLE public.payer_directory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payer_name TEXT NOT NULL,
  payer_type TEXT,
  phone_number TEXT,
  fax_number TEXT,
  claims_address TEXT,
  portal_url TEXT,
  timely_filing_days INTEGER DEFAULT 365,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for company lookups
CREATE INDEX idx_payer_directory_company_id ON public.payer_directory(company_id);
CREATE INDEX idx_payer_directory_payer_type ON public.payer_directory(company_id, payer_type);

-- Enable RLS
ALTER TABLE public.payer_directory ENABLE ROW LEVEL SECURITY;

-- Select policy for owner/billing
CREATE POLICY "Billing users can view payer directory"
ON public.payer_directory FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND public.is_billing()
);

-- Insert policy
CREATE POLICY "Billing users can add payer directory entries"
ON public.payer_directory FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND public.is_billing()
);

-- Update policy
CREATE POLICY "Billing users can edit payer directory entries"
ON public.payer_directory FOR UPDATE
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND public.is_billing()
)
WITH CHECK (
  company_id = public.get_my_company_id()
  AND public.is_billing()
);

-- Updated_at trigger
CREATE TRIGGER update_payer_directory_updated_at
BEFORE UPDATE ON public.payer_directory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default payers for all existing companies that have no rows yet
INSERT INTO public.payer_directory (company_id, payer_name, payer_type, phone_number, portal_url, timely_filing_days)
SELECT c.id, 'Medicare', 'medicare', '1-800-633-4227', 'https://www.medicare.gov', 365
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.payer_directory pd WHERE pd.company_id = c.id);

INSERT INTO public.payer_directory (company_id, payer_name, payer_type, phone_number, portal_url, timely_filing_days)
SELECT c.id, 'Georgia Medicaid', 'medicaid', '1-800-766-4456', 'https://mmis.georgia.gov', 365
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.payer_directory pd WHERE pd.company_id = c.id AND pd.payer_type = 'medicaid');
