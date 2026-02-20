
-- Create operational_alerts table for crew "Patient Not Ready" signals
CREATE TABLE public.operational_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  truck_id uuid NOT NULL REFERENCES public.trucks(id),
  leg_id uuid NOT NULL REFERENCES public.scheduling_legs(id),
  alert_type text NOT NULL DEFAULT 'PATIENT_NOT_READY',
  note text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text,
  resolved_at timestamp with time zone,
  resolved_by text
);

-- Enable RLS
ALTER TABLE public.operational_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can do everything (scoped to company)
CREATE POLICY "Admins manage operational_alerts"
  ON public.operational_alerts
  FOR ALL
  USING (is_admin() AND (company_id = get_my_company_id()));

-- Service role (edge function) can insert — handled via service role key directly

-- Index for common queries
CREATE INDEX idx_operational_alerts_date_company ON public.operational_alerts (run_date, company_id);
CREATE INDEX idx_operational_alerts_leg ON public.operational_alerts (leg_id);
CREATE INDEX idx_operational_alerts_truck ON public.operational_alerts (truck_id, run_date);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_alerts;
