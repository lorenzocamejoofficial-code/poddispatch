
CREATE TABLE public.loadtest_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  triggered_by uuid,
  scenario_seconds integer,
  tenant_count integer,
  summary jsonb,
  isolation_results jsonb,
  latency_results jsonb,
  errors jsonb,
  manifest jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loadtest_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creators read loadtest reports"
  ON public.loadtest_reports FOR SELECT
  TO authenticated
  USING (public.is_system_creator());

CREATE POLICY "System creators insert loadtest reports"
  ON public.loadtest_reports FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators update loadtest reports"
  ON public.loadtest_reports FOR UPDATE
  TO authenticated
  USING (public.is_system_creator());

CREATE INDEX idx_loadtest_reports_started ON public.loadtest_reports(started_at DESC);
