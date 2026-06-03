ALTER TABLE public.comms_events ALTER COLUMN trip_id DROP NOT NULL;
ALTER TABLE public.comms_events ALTER COLUMN truck_id DROP NOT NULL;

ALTER TABLE public.comms_events
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recording_sid text,
  ADD COLUMN IF NOT EXISTS recording_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS to_number text,
  ADD COLUMN IF NOT EXISTS retry_of_event_id uuid REFERENCES public.comms_events(id) ON DELETE SET NULL;

ALTER TABLE public.comms_events
  ADD CONSTRAINT comms_events_direction_chk CHECK (direction IN ('outbound','inbound'));

CREATE INDEX IF NOT EXISTS idx_comms_events_company_created
  ON public.comms_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comms_events_to_number
  ON public.comms_events (to_number) WHERE to_number IS NOT NULL;

-- Service role inserts (for inbound webhook logging)
DROP POLICY IF EXISTS "Service inserts comms_events" ON public.comms_events;
CREATE POLICY "Service inserts comms_events" ON public.comms_events
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service updates comms_events" ON public.comms_events;
CREATE POLICY "Service updates comms_events" ON public.comms_events
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_events TO authenticated;
GRANT ALL ON public.comms_events TO service_role;