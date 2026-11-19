ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS coverage_provider text NOT NULL DEFAULT 'stub'
  CHECK (coverage_provider IN ('stub','office_ally'));

CREATE TABLE public.coverage_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  check_type text NOT NULL CHECK (check_type IN ('eligibility','discovery')),
  source text NOT NULL CHECK (source IN ('stub','office_ally')),
  status text NOT NULL,
  payer_name text,
  payer_member_id text,
  plan_name text,
  coverage_start date,
  coverage_end date,
  implied_cob_order text NOT NULL DEFAULT 'unknown' CHECK (implied_cob_order IN ('primary','secondary','unknown')),
  confidence text CHECK (confidence IN ('high','medium','low')),
  raw_response jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  reviewed boolean NOT NULL DEFAULT false,
  review_action text CHECK (review_action IN ('confirmed_primary','confirmed_secondary','dismissed')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coverage_checks_status_by_type CHECK (
    (check_type = 'eligibility' AND status IN ('active','inactive','unknown')) OR
    (check_type = 'discovery' AND status IN ('coverage_found','none'))
  ),
  CONSTRAINT coverage_checks_review_consistent CHECK (
    (reviewed = false AND review_action IS NULL) OR (reviewed = true AND review_action IS NOT NULL)
  )
);

CREATE INDEX coverage_checks_company_patient_idx ON public.coverage_checks (company_id, patient_id);

GRANT SELECT, INSERT, UPDATE ON public.coverage_checks TO authenticated;
GRANT ALL ON public.coverage_checks TO service_role;

ALTER TABLE public.coverage_checks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.guard_coverage_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'coverage check patient must belong to the same company';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.check_type IS DISTINCT FROM OLD.check_type OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.status IS DISTINCT FROM OLD.status OR NEW.payer_name IS DISTINCT FROM OLD.payer_name
       OR NEW.payer_member_id IS DISTINCT FROM OLD.payer_member_id OR NEW.plan_name IS DISTINCT FROM OLD.plan_name
       OR NEW.coverage_start IS DISTINCT FROM OLD.coverage_start OR NEW.coverage_end IS DISTINCT FROM OLD.coverage_end
       OR NEW.implied_cob_order IS DISTINCT FROM OLD.implied_cob_order OR NEW.confidence IS DISTINCT FROM OLD.confidence
       OR NEW.raw_response IS DISTINCT FROM OLD.raw_response OR NEW.checked_at IS DISTINCT FROM OLD.checked_at THEN
      RAISE EXCEPTION 'coverage check results are immutable; only review fields may change';
    END IF;
    IF OLD.reviewed THEN
      RAISE EXCEPTION 'coverage check already reviewed';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_coverage_check_trg
BEFORE INSERT OR UPDATE ON public.coverage_checks
FOR EACH ROW EXECUTE FUNCTION public.guard_coverage_check();

CREATE POLICY "Company staff read coverage_checks" ON public.coverage_checks
  FOR SELECT TO authenticated
  USING ((public.is_admin() OR public.is_dispatcher() OR public.is_billing()) AND company_id = public.get_my_company_id());

CREATE POLICY "Owner and billing insert coverage_checks" ON public.coverage_checks
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin() OR public.is_billing()) AND company_id = public.get_my_company_id());

CREATE POLICY "Owner and billing review coverage_checks" ON public.coverage_checks
  FOR UPDATE TO authenticated
  USING ((public.is_admin() OR public.is_billing()) AND company_id = public.get_my_company_id())
  WITH CHECK ((public.is_admin() OR public.is_billing()) AND company_id = public.get_my_company_id());