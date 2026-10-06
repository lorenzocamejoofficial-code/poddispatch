ALTER TABLE public.simulation_runs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_simulation_runs_company ON public.simulation_runs(company_id);