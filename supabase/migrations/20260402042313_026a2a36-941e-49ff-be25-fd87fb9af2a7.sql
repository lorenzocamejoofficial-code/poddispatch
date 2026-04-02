
-- Add call-specific columns to comms_events for the Communications feature
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS call_type text;
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS patient_name text;
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS facility_name text;
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS message_text text;
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS eta_used text;
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS queued_by uuid;
ALTER TABLE public.comms_events ADD COLUMN IF NOT EXISTS queued_at timestamptz DEFAULT now();

-- Add dispatcher insert policy
CREATE POLICY "Dispatchers insert comms_events"
  ON public.comms_events
  FOR INSERT
  TO authenticated
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());
