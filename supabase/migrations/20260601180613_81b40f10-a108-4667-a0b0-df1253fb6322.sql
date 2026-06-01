ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS hospice_enrolled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hospice_election_date date NULL,
  ADD COLUMN IF NOT EXISTS terminal_illness_icd text NULL;

ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS hospice_unrelated_to_terminal boolean NOT NULL DEFAULT false;