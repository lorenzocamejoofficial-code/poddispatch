
CREATE TABLE public.customer_payer_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  payer_id uuid NOT NULL REFERENCES public.payer_directory(id) ON DELETE CASCADE,
  era_enrolled boolean NOT NULL DEFAULT false,
  era_enrolled_at timestamptz,
  eft_enrolled boolean NOT NULL DEFAULT false,
  eft_enrolled_at timestamptz,
  edi_enrolled boolean NOT NULL DEFAULT false,
  edi_enrolled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, payer_id)
);

CREATE INDEX idx_cpe_company ON public.customer_payer_enrollments(company_id);

ALTER TABLE public.customer_payer_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpe_select" ON public.customer_payer_enrollments
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "cpe_insert" ON public.customer_payer_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "cpe_update" ON public.customer_payer_enrollments
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() OR public.is_system_creator())
  WITH CHECK (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "cpe_delete" ON public.customer_payer_enrollments
  FOR DELETE TO authenticated
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE TRIGGER cpe_updated_at
  BEFORE UPDATE ON public.customer_payer_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: one enrollment row per existing payer
INSERT INTO public.customer_payer_enrollments (company_id, payer_id)
SELECT pd.company_id, pd.id
FROM public.payer_directory pd
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_payer_enrollments cpe
  WHERE cpe.company_id = pd.company_id AND cpe.payer_id = pd.id
);
