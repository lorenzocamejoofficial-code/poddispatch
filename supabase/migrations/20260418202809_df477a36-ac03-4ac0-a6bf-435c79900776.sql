CREATE TABLE public.patient_schedule_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  chair_time TIME,
  duration_hours INTEGER,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (patient_id, weekday)
);

CREATE INDEX idx_pso_patient ON public.patient_schedule_overrides(patient_id);
CREATE INDEX idx_pso_company ON public.patient_schedule_overrides(company_id);

ALTER TABLE public.patient_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read patient_schedule_overrides"
ON public.patient_schedule_overrides
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());

CREATE POLICY "Admins and dispatchers manage patient_schedule_overrides"
ON public.patient_schedule_overrides
FOR ALL
TO authenticated
USING ((is_admin() OR is_dispatcher()) AND company_id = get_my_company_id())
WITH CHECK ((is_admin() OR is_dispatcher()) AND company_id = get_my_company_id());

CREATE POLICY "System creator read patient_schedule_overrides"
ON public.patient_schedule_overrides
FOR SELECT
TO authenticated
USING (is_system_creator());

CREATE TRIGGER update_pso_updated_at
BEFORE UPDATE ON public.patient_schedule_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();