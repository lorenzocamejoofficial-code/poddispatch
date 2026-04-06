
ALTER TABLE public.trip_records ADD COLUMN IF NOT EXISTS icd10_codes text[] DEFAULT '{}';
ALTER TABLE public.trip_records ADD COLUMN IF NOT EXISTS weight_lbs integer;
ALTER TABLE public.claim_records ADD COLUMN IF NOT EXISTS patient_sex text;
