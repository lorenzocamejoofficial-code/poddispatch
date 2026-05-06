CREATE TABLE public.claim_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_record_id uuid NOT NULL REFERENCES public.claim_records(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN
    ('payment','reversal','correction','secondary_payment','adjustment')),
  clp_status_code text,
  amount numeric NOT NULL DEFAULT 0,
  patient_responsibility numeric NOT NULL DEFAULT 0,
  write_off numeric NOT NULL DEFAULT 0,
  allowed_amount numeric,
  denial_code text,
  denial_reason text,
  adjustment_codes text[] DEFAULT ARRAY[]::text[],
  payer_claim_control_number text,
  remittance_file_id uuid,
  payment_date date,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_claim_payments_claim ON public.claim_payments(claim_record_id);
CREATE INDEX idx_claim_payments_company ON public.claim_payments(company_id);
CREATE INDEX idx_claim_payments_pccn ON public.claim_payments(payer_claim_control_number);
CREATE INDEX idx_claim_payments_remittance ON public.claim_payments(remittance_file_id);

ALTER TABLE public.claim_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_payments select scope"
  ON public.claim_payments FOR SELECT
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "claim_payments insert scope"
  ON public.claim_payments FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "claim_payments update scope"
  ON public.claim_payments FOR UPDATE
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE POLICY "claim_payments delete scope"
  ON public.claim_payments FOR DELETE
  USING (company_id = public.get_my_company_id() OR public.is_system_creator());

CREATE OR REPLACE FUNCTION public.recompute_claim_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_claim_id uuid;
  v_sum_paid numeric;
  v_sum_pr numeric;
  v_sum_wo numeric;
  v_last record;
  v_codes text[];
  v_status public.claim_status;
BEGIN
  v_claim_id := COALESCE(NEW.claim_record_id, OLD.claim_record_id);
  IF v_claim_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(patient_responsibility), 0),
    COALESCE(SUM(write_off), 0)
  INTO v_sum_paid, v_sum_pr, v_sum_wo
  FROM public.claim_payments WHERE claim_record_id = v_claim_id;

  SELECT *
  INTO v_last
  FROM public.claim_payments
  WHERE claim_record_id = v_claim_id
  ORDER BY applied_at DESC, created_at DESC
  LIMIT 1;

  SELECT COALESCE(array_agg(DISTINCT c), ARRAY[]::text[])
  INTO v_codes
  FROM public.claim_payments cp,
       LATERAL unnest(COALESCE(cp.adjustment_codes, ARRAY[]::text[])) c
  WHERE cp.claim_record_id = v_claim_id;

  IF v_last.id IS NULL THEN
    v_status := NULL;
  ELSIF v_last.event_type = 'reversal' AND v_sum_paid <= 0 THEN
    v_status := 'needs_correction'::public.claim_status;
  ELSIF v_last.clp_status_code IN ('4','11','23') THEN
    v_status := 'denied'::public.claim_status;
  ELSIF v_last.clp_status_code IN ('5','13','15','25') THEN
    v_status := 'pending'::public.claim_status;
  ELSIF v_last.clp_status_code IN ('19','20','21') THEN
    v_status := 'forwarded'::public.claim_status;
  ELSIF v_sum_paid > 0 THEN
    v_status := 'paid'::public.claim_status;
  ELSE
    v_status := 'needs_correction'::public.claim_status;
  END IF;

  UPDATE public.claim_records
  SET amount_paid                     = v_sum_paid,
      patient_responsibility_amount   = NULLIF(v_sum_pr, 0),
      write_off_amount                = NULLIF(v_sum_wo, 0),
      allowed_amount                  = COALESCE(v_last.allowed_amount, allowed_amount),
      denial_code                     = COALESCE(v_last.denial_code, denial_code),
      denial_reason                   = COALESCE(v_last.denial_reason, denial_reason),
      paid_at                         = CASE WHEN v_status = 'paid'::public.claim_status
                                              THEN COALESCE(v_last.payment_date::timestamptz, paid_at)
                                              ELSE paid_at END,
      remittance_date                 = COALESCE(v_last.payment_date, remittance_date),
      payer_claim_control_number      = COALESCE(v_last.payer_claim_control_number, payer_claim_control_number),
      adjustment_codes                = v_codes,
      status                          = COALESCE(v_status, status),
      updated_at                      = now()
  WHERE id = v_claim_id;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

CREATE TRIGGER trg_claim_payments_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.claim_payments
FOR EACH ROW EXECUTE FUNCTION public.recompute_claim_from_payments();