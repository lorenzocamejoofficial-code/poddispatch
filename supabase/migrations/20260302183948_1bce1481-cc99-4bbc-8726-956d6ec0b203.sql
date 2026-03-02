
-- Objective A: Add revenue_risk_score to trip_records
ALTER TABLE public.trip_records ADD COLUMN IF NOT EXISTS revenue_risk_score numeric DEFAULT NULL;

-- Objective B: Add on-time and root cause fields to trip_projection_state
ALTER TABLE public.trip_projection_state ADD COLUMN IF NOT EXISTS on_time_status text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.trip_projection_state ADD COLUMN IF NOT EXISTS late_root_cause text DEFAULT NULL;
ALTER TABLE public.trip_projection_state ADD COLUMN IF NOT EXISTS actual_arrival_at timestamptz DEFAULT NULL;
ALTER TABLE public.trip_projection_state ADD COLUMN IF NOT EXISTS scheduled_pickup_time time DEFAULT NULL;

-- Objective B: Daily truck metrics table for per-truck per-day aggregation
CREATE TABLE public.daily_truck_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  simulation_run_id uuid NULL,
  run_date date NOT NULL,
  total_trips integer NOT NULL DEFAULT 0,
  on_time_count integer NOT NULL DEFAULT 0,
  late_count integer NOT NULL DEFAULT 0,
  on_time_pct numeric NOT NULL DEFAULT 0,
  avg_facility_wait_min numeric NOT NULL DEFAULT 0,
  total_wait_min numeric NOT NULL DEFAULT 0,
  operational_risk_score numeric NOT NULL DEFAULT 0,
  late_causes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(truck_id, run_date)
);

ALTER TABLE public.daily_truck_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage daily_truck_metrics" ON public.daily_truck_metrics
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read daily_truck_metrics" ON public.daily_truck_metrics
  FOR SELECT TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read daily_truck_metrics" ON public.daily_truck_metrics
  FOR SELECT TO authenticated
  USING (is_system_creator());
