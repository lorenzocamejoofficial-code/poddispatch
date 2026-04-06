
-- Add verification columns to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS npi_verified boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS npi_registered_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS medicare_enrolled boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS medicare_specialty text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS oig_excluded boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS oig_exclusion_details text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verification_checked_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verified_by uuid;

-- Add additional signup context fields
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS current_software text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS years_in_operation integer;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS has_inhouse_biller boolean DEFAULT false;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hipaa_privacy_officer text;
