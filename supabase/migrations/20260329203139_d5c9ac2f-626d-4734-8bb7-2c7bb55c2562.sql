
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pcs_on_file boolean DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pcs_signed_date date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS pcs_expiration_date date;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS prior_auth_on_file boolean DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS prior_auth_number text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS prior_auth_expiration date;
