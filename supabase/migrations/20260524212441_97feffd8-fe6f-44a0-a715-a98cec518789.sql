
ALTER TABLE public.payer_directory
  ADD COLUMN IF NOT EXISTS oa_payer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payer_directory_company_oa_payer_id_key
  ON public.payer_directory (company_id, UPPER(oa_payer_id))
  WHERE oa_payer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payer_directory_company_type_idx
  ON public.payer_directory (company_id, payer_type);

CREATE INDEX IF NOT EXISTS payer_directory_company_oa_idx
  ON public.payer_directory (company_id, oa_payer_id);

COMMENT ON COLUMN public.payer_directory.oa_payer_id IS
  'Office Ally clearinghouse payer ID. Emitted as NM109 in 837P Loop 2010BB. Must be verified against the official OA payer list before use.';
