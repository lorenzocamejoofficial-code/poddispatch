
-- Phase A: Dispatch Intelligence v1 — New tables

-- 1. trip_events
CREATE TABLE public.trip_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  simulation_run_id uuid NULL,
  trip_id uuid NOT NULL REFERENCES public.trip_records(id) ON DELETE CASCADE,
  slot_id uuid NULL REFERENCES public.truck_run_slots(id) ON DELETE SET NULL,
  truck_id uuid NOT NULL REFERENCES public.trucks(id),
  crew_id uuid NULL REFERENCES public.crews(id),
  event_type text NOT NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'crew',
  meta jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trip_events" ON public.trip_events FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage trip_events" ON public.trip_events FOR ALL
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read trip_events" ON public.trip_events FOR SELECT
  USING (is_system_creator());

-- 2. hold_timers
CREATE TABLE public.hold_timers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  simulation_run_id uuid NULL,
  trip_id uuid NOT NULL REFERENCES public.trip_records(id) ON DELETE CASCADE,
  slot_id uuid NULL REFERENCES public.truck_run_slots(id),
  hold_type text NOT NULL,
  started_at timestamptz NOT NULL,
  resolved_at timestamptz NULL,
  current_level text NOT NULL DEFAULT 'green',
  last_escalated_at timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hold_timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage hold_timers" ON public.hold_timers FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage hold_timers" ON public.hold_timers FOR ALL
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read hold_timers" ON public.hold_timers FOR SELECT
  USING (is_system_creator());

-- 3. trip_projection_state
CREATE TABLE public.trip_projection_state (
  trip_id uuid PRIMARY KEY REFERENCES public.trip_records(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  simulation_run_id uuid NULL,
  projected_complete_at timestamptz NULL,
  projected_next_arrival_at timestamptz NULL,
  late_probability numeric NOT NULL DEFAULT 0,
  risk_color text NOT NULL DEFAULT 'green',
  confidence numeric NOT NULL DEFAULT 0.5,
  reason_codes text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_projection_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trip_projection_state" ON public.trip_projection_state FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read trip_projection_state" ON public.trip_projection_state FOR SELECT
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read trip_projection_state" ON public.trip_projection_state FOR SELECT
  USING (is_system_creator());

-- 4. truck_risk_state
CREATE TABLE public.truck_risk_state (
  truck_id uuid PRIMARY KEY REFERENCES public.trucks(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  simulation_run_id uuid NULL,
  late_probability numeric NOT NULL DEFAULT 0,
  risk_color text NOT NULL DEFAULT 'green',
  collapse_index numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.truck_risk_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage truck_risk_state" ON public.truck_risk_state FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read truck_risk_state" ON public.truck_risk_state FOR SELECT
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read truck_risk_state" ON public.truck_risk_state FOR SELECT
  USING (is_system_creator());

-- 5. comms_events
CREATE TABLE public.comms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  simulation_run_id uuid NULL,
  trip_id uuid NOT NULL REFERENCES public.trip_records(id) ON DELETE CASCADE,
  facility_id uuid NULL REFERENCES public.facilities(id),
  truck_id uuid NOT NULL REFERENCES public.trucks(id),
  event_type text NOT NULL,
  payload jsonb NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage comms_events" ON public.comms_events FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read comms_events" ON public.comms_events FOR SELECT
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read comms_events" ON public.comms_events FOR SELECT
  USING (is_system_creator());

-- Indexes for performance
CREATE INDEX idx_trip_events_trip ON public.trip_events(trip_id);
CREATE INDEX idx_trip_events_truck_date ON public.trip_events(truck_id, event_time);
CREATE INDEX idx_hold_timers_active ON public.hold_timers(is_active, company_id) WHERE is_active = true;
CREATE INDEX idx_hold_timers_trip ON public.hold_timers(trip_id);
CREATE INDEX idx_comms_events_trip ON public.comms_events(trip_id);
CREATE INDEX idx_comms_events_status ON public.comms_events(status, company_id);

-- Enable realtime for hold_timers and truck_risk_state
ALTER PUBLICATION supabase_realtime ADD TABLE public.hold_timers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.truck_risk_state;
