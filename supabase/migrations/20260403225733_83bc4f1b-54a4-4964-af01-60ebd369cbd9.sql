
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS exported_at timestamp with time zone DEFAULT NULL;
