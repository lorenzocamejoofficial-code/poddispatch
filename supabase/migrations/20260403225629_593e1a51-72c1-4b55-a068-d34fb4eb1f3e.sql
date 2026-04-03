
-- Migration 3: eligibility_checks table
CREATE TABLE public.eligibility_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  checked_by uuid,
  payer_type text,
  is_eligible boolean,
  coverage_start date,
  coverage_end date,
  response_summary text,
  raw_response jsonb
);

ALTER TABLE public.eligibility_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin dispatcher billing read eligibility_checks"
  ON public.eligibility_checks FOR SELECT
  TO authenticated
  USING (
    (is_admin() OR is_dispatcher() OR is_billing()) AND company_id = get_my_company_id()
  );

CREATE POLICY "Owner and billing insert eligibility_checks"
  ON public.eligibility_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_admin() OR is_billing()) AND company_id = get_my_company_id()
  );

CREATE POLICY "System creator read eligibility_checks"
  ON public.eligibility_checks FOR SELECT
  TO authenticated
  USING (is_system_creator());
