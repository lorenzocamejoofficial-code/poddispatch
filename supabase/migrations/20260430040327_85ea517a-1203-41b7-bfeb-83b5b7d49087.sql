ALTER TABLE public.remittance_files
  ADD COLUMN IF NOT EXISTS file_identifier text;

CREATE UNIQUE INDEX IF NOT EXISTS remittance_files_company_file_identifier_key
  ON public.remittance_files (company_id, file_identifier)
  WHERE file_identifier IS NOT NULL;