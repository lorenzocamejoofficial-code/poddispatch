ALTER TABLE public.vendor_clearinghouse_settings
  ADD COLUMN IF NOT EXISTS eligibility_rest_url_test text,
  ADD COLUMN IF NOT EXISTS eligibility_rest_url_prod text;