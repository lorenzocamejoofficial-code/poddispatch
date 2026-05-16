ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS default_chief_complaint_other       text,
  ADD COLUMN IF NOT EXISTS default_primary_impression_other    text,
  ADD COLUMN IF NOT EXISTS pcs_signed_date                     date,
  ADD COLUMN IF NOT EXISTS prior_auth_utn                      text,
  ADD COLUMN IF NOT EXISTS prior_auth_period_start             date,
  ADD COLUMN IF NOT EXISTS prior_auth_period_end               date;

ALTER TABLE public.patients
  DROP CONSTRAINT IF EXISTS chk_prior_auth_period_valid;

ALTER TABLE public.patients
  ADD CONSTRAINT chk_prior_auth_period_valid
  CHECK (
    prior_auth_period_end IS NULL
    OR prior_auth_period_start IS NULL
    OR prior_auth_period_end >= prior_auth_period_start
  );

COMMENT ON COLUMN public.patients.pcs_signed_date IS
  'Date the Physician Certification Statement was signed. Per 42 CFR 410.40(d), PCS must be dated no earlier than 60 days before the date of service for non-emergency Medicare transport.';
COMMENT ON COLUMN public.patients.prior_auth_utn IS
  'RSNAT Unique Tracking Number from MAC affirmative prior auth decision. Required when Medicare patient meets RSNAT frequency thresholds (>=3 round trips/10 days OR >=1/week for >=3 weeks).';
COMMENT ON COLUMN public.patients.default_chief_complaint_other IS
  'Free-text chief complaint shown when default_chief_complaint = "Other".';
COMMENT ON COLUMN public.patients.default_primary_impression_other IS
  'Free-text primary impression shown when default_primary_impression = "Other".';