
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS secondary_group_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS secondary_payer_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS secondary_payer_id text DEFAULT NULL;
