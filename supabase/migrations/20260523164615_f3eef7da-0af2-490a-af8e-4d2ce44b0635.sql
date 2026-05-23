CREATE UNIQUE INDEX IF NOT EXISTS companies_npi_number_unique_active
  ON public.companies (npi_number)
  WHERE npi_number IS NOT NULL
    AND length(btrim(npi_number)) > 0
    AND deleted_at IS NULL;