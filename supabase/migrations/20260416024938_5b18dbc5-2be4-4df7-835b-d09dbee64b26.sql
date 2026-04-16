ALTER TABLE public.scheduling_legs
  ADD COLUMN IF NOT EXISTS oneoff_dob date,
  ADD COLUMN IF NOT EXISTS oneoff_sex text,
  ADD COLUMN IF NOT EXISTS oneoff_primary_payer text,
  ADD COLUMN IF NOT EXISTS oneoff_member_id text;