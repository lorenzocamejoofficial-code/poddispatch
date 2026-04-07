
-- Add cancellation_documentation and cancellation_source columns to trip_records
ALTER TABLE public.trip_records 
  ADD COLUMN IF NOT EXISTS cancellation_documentation jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_source text DEFAULT NULL;
