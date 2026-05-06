ALTER TABLE public.remittance_files
  ADD COLUMN IF NOT EXISTS bpr_total_paid numeric,
  ADD COLUMN IF NOT EXISTS reconciled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconciliation_variance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payer_name text,
  ADD COLUMN IF NOT EXISTS eft_trace_number text,
  ADD COLUMN IF NOT EXISTS payment_date date;

CREATE TABLE public.plb_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remittance_file_id uuid NOT NULL REFERENCES public.remittance_files(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  provider_npi text,
  fiscal_period date,
  reason_code text NOT NULL,
  reference_id text,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plb_remittance ON public.plb_adjustments(remittance_file_id);
CREATE INDEX idx_plb_company ON public.plb_adjustments(company_id);

ALTER TABLE public.plb_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plb select scope"
  ON public.plb_adjustments FOR SELECT
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "plb insert scope"
  ON public.plb_adjustments FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "plb update scope"
  ON public.plb_adjustments FOR UPDATE
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "plb delete scope"
  ON public.plb_adjustments FOR DELETE
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());