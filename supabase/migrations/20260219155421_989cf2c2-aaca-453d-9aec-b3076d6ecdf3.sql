-- Add transport type enum
CREATE TYPE public.transport_type AS ENUM ('dialysis', 'outpatient', 'adhoc');

-- Add recurrence fields to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS transport_type public.transport_type NOT NULL DEFAULT 'dialysis',
  ADD COLUMN IF NOT EXISTS recurrence_start_date date NULL,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date NULL;

-- Add exception overrides table for single-occurrence edits
CREATE TABLE IF NOT EXISTS public.leg_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduling_leg_id uuid NOT NULL REFERENCES public.scheduling_legs(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  pickup_time time without time zone NULL,
  pickup_location text NULL,
  destination_location text NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(scheduling_leg_id, run_date)
);

-- RLS for leg_exceptions
ALTER TABLE public.leg_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage leg exceptions"
  ON public.leg_exceptions
  FOR ALL
  USING (is_admin());

CREATE POLICY "Crew read leg exceptions"
  ON public.leg_exceptions
  FOR SELECT
  USING (true);