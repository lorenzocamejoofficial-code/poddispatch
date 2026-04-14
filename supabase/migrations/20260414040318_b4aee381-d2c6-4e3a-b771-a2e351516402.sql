-- Ensure Medicare rows have correct timely filing
UPDATE public.payer_directory SET timely_filing_days = 365 WHERE payer_type = 'medicare' AND timely_filing_days IS DISTINCT FROM 365;

-- Ensure Georgia Medicaid rows have correct timely filing
UPDATE public.payer_directory SET timely_filing_days = 365 WHERE payer_type = 'medicaid' AND timely_filing_days IS DISTINCT FROM 365;

-- Seed Commercial Insurance for companies that don't have it
INSERT INTO public.payer_directory (company_id, payer_name, payer_type, timely_filing_days)
SELECT c.id, 'Commercial Insurance', 'commercial', 180
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.payer_directory pd
  WHERE pd.company_id = c.id AND pd.payer_type = 'commercial'
);

-- Seed Facility Contract for companies that don't have it
INSERT INTO public.payer_directory (company_id, payer_name, payer_type, timely_filing_days)
SELECT c.id, 'Facility Contract', 'facility', 90
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.payer_directory pd
  WHERE pd.company_id = c.id AND pd.payer_type = 'facility'
);