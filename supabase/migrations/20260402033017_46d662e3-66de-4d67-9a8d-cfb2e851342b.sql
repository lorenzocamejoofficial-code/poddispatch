
-- Add company profile columns
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS npi_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS state_of_operation text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS service_area_type text DEFAULT 'urban';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payer_mix_medicare integer DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payer_mix_medicaid integer DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payer_mix_facility integer DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payer_mix_private integer DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS truck_count integer DEFAULT 0;

-- Add onboarding step tracking to migration_settings
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS step_rates_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS step_trucks_added boolean NOT NULL DEFAULT false;
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS step_patients_added boolean NOT NULL DEFAULT false;
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS step_team_invited boolean NOT NULL DEFAULT false;
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS step_first_trip boolean NOT NULL DEFAULT false;
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS onboarding_dismissed boolean NOT NULL DEFAULT false;

-- Add trial fields to subscription_records
ALTER TABLE public.subscription_records ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
