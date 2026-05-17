ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS pcs_physician_npi text,
  ADD COLUMN IF NOT EXISTS pcs_physician_name text;

COMMENT ON COLUMN public.patients.pcs_physician_npi IS
'NPI of the attending physician who signed the PCS. Emitted in 837P NM1*DK (referring provider) loop. Required when pcs_on_file = true.';

COMMENT ON COLUMN public.patients.pcs_physician_name IS
'Full name of the physician who signed the PCS, as it appears on the PCS form.';