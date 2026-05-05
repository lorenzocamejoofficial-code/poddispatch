ALTER TABLE public.facilities
  ADD COLUMN dialysis_subtype text
  CHECK (dialysis_subtype IS NULL OR dialysis_subtype IN ('hospital_based', 'freestanding', 'unknown'));

COMMENT ON COLUMN public.facilities.dialysis_subtype IS
  'Only populated when facility_type = ''dialysis''. Drives EDI 837P origin/destination modifier (G = hospital-based, J = freestanding, D = unknown / generic). Required for new dialysis facilities.';