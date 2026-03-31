
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS kickback_reasons jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS kickback_note text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kicked_back_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS kicked_back_at timestamptz DEFAULT NULL;
