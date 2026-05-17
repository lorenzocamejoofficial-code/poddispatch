-- Defensive backfill (no-op since rows = 0, but safe)
UPDATE public.patients
SET prior_auth_utn = COALESCE(prior_auth_utn, prior_auth_number)
WHERE prior_auth_number IS NOT NULL AND prior_auth_utn IS NULL;

UPDATE public.patients
SET prior_auth_period_end = COALESCE(prior_auth_period_end, prior_auth_expiration)
WHERE prior_auth_expiration IS NOT NULL AND prior_auth_period_end IS NULL;

-- Drop legacy duplicate columns
ALTER TABLE public.patients DROP COLUMN IF EXISTS prior_auth_number;
ALTER TABLE public.patients DROP COLUMN IF EXISTS prior_auth_expiration;
ALTER TABLE public.patients DROP COLUMN IF EXISTS prior_auth_on_file;

-- Column comments for clarity
COMMENT ON COLUMN public.patients.prior_auth_utn IS 'RSNAT Unique Tracking Number issued by Medicare MAC (42 CFR 410.40)';
COMMENT ON COLUMN public.patients.prior_auth_period_start IS 'RSNAT prior auth period start date';
COMMENT ON COLUMN public.patients.prior_auth_period_end IS 'RSNAT prior auth period end date';
COMMENT ON COLUMN public.patients.auth_required IS 'Non-RSNAT payer authorization required (Medicaid MCO, commercial pre-auth, etc.)';
COMMENT ON COLUMN public.patients.auth_expiration IS 'Non-RSNAT payer authorization expiration date';