
ALTER TABLE public.comms_events
  ADD COLUMN IF NOT EXISTS twilio_call_sid text,
  ADD COLUMN IF NOT EXISTS called_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_status text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS from_number text;

CREATE INDEX IF NOT EXISTS idx_comms_events_twilio_call_sid
  ON public.comms_events(twilio_call_sid)
  WHERE twilio_call_sid IS NOT NULL;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS verified_caller_id text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.comms_events;
ALTER TABLE public.comms_events REPLICA IDENTITY FULL;
