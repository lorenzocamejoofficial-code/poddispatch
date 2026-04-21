ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS handoff_target_truck_id uuid DEFAULT NULL REFERENCES public.trucks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_target_crew_id uuid DEFAULT NULL REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trip_records_handoff_target_crew
  ON public.trip_records (handoff_target_crew_id)
  WHERE handoff_target_crew_id IS NOT NULL;