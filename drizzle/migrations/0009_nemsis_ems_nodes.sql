CREATE TABLE public.nemsis_ems_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  case_key text NOT NULL CHECK (case_key IN ('EMS1','EMS2','EMS3','EMS4','EMS5')),
  section text NOT NULL,
  parent_id uuid REFERENCES public.nemsis_ems_nodes(id) ON DELETE CASCADE,
  tag text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  uuid text,
  correlation_id text,
  "values" jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX nemsis_ems_nodes_company_case_idx ON public.nemsis_ems_nodes(company_id, case_key, section);
CREATE INDEX nemsis_ems_nodes_parent_idx ON public.nemsis_ems_nodes(parent_id);
COMMENT ON TABLE public.nemsis_ems_nodes IS 'NEMSIS certification EMS case records (EMSDataSet PatientCareReport): one root row per section per case and one row per group instance. Certification company only.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nemsis_ems_nodes TO authenticated;
GRANT ALL ON public.nemsis_ems_nodes TO service_role;
ALTER TABLE public.nemsis_ems_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators manage certification EMS cases" ON public.nemsis_ems_nodes
  FOR ALL TO authenticated USING (public.is_system_creator()) WITH CHECK (public.is_system_creator());

CREATE OR REPLACE FUNCTION public.guard_nemsis_ems_node()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id
      AND c.nemsis_certification AND (COALESCE(c.is_sandbox,false) OR COALESCE(c.creator_test_tenant,false))) THEN
    RAISE EXCEPTION 'Certification EMS case records are allowed only on the certification company';
  END IF;
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.nemsis_ems_nodes p
      WHERE p.id = NEW.parent_id AND p.company_id = NEW.company_id AND p.case_key = NEW.case_key AND p.section = NEW.section) THEN
    RAISE EXCEPTION 'Parent record must belong to the same company, case and section';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_nemsis_ems_node
BEFORE INSERT OR UPDATE ON public.nemsis_ems_nodes
FOR EACH ROW EXECUTE FUNCTION public.guard_nemsis_ems_node();