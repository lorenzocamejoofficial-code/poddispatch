-- Add handoff tracking columns to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS handoff_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS handoff_initiated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS original_crew_id uuid DEFAULT NULL REFERENCES public.crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pre_handoff_signatures_snapshot jsonb DEFAULT NULL;

-- Index on handoff_status for query performance
CREATE INDEX IF NOT EXISTS idx_trip_records_handoff_status
  ON public.trip_records (handoff_status)
  WHERE handoff_status IS NOT NULL;

-- Ensure trip_records is included in realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_records;
  END IF;
END $$;

-- Ensure REPLICA IDENTITY FULL so realtime sends complete row data on UPDATE
ALTER TABLE public.trip_records REPLICA IDENTITY FULL;