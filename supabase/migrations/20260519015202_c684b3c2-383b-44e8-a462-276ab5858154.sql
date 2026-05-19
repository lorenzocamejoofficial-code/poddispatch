
-- 1. Add is_simulated columns (default false, NOT NULL)
ALTER TABLE public.claim_payments    ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE public.plb_adjustments   ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;
ALTER TABLE public.remittance_files  ADD COLUMN IF NOT EXISTS is_simulated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.claim_payments.is_simulated   IS 'True when this payment was posted from a synthetic 835. Propagated from remittance_files.is_simulated by the parser. Blocked from real customer tenants by guard_simulated_payment trigger.';
COMMENT ON COLUMN public.plb_adjustments.is_simulated  IS 'True when sourced from a synthetic 835 file.';
COMMENT ON COLUMN public.remittance_files.is_simulated IS 'True when this 835 was imported as test fixture data. Only allowed on creator_test_tenant or is_sandbox companies.';

-- 2. Guard trigger: reject is_simulated=true rows on non-test tenants.
CREATE OR REPLACE FUNCTION public.guard_simulated_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_test_tenant boolean;
BEGIN
  IF COALESCE(NEW.is_simulated, false) = false THEN
    RETURN NEW;
  END IF;
  SELECT (COALESCE(creator_test_tenant, false) OR COALESCE(is_sandbox, false))
    INTO v_is_test_tenant
    FROM public.companies WHERE id = NEW.company_id;
  IF NOT COALESCE(v_is_test_tenant, false) THEN
    RAISE EXCEPTION
      'is_simulated=true is only permitted on creator_test_tenant or is_sandbox companies (table=%, company_id=%)',
      TG_TABLE_NAME, NEW.company_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_simulated_payment_trg ON public.claim_payments;
CREATE TRIGGER guard_simulated_payment_trg
  BEFORE INSERT OR UPDATE OF is_simulated ON public.claim_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_simulated_payment();

DROP TRIGGER IF EXISTS guard_simulated_plb_trg ON public.plb_adjustments;
CREATE TRIGGER guard_simulated_plb_trg
  BEFORE INSERT OR UPDATE OF is_simulated ON public.plb_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.guard_simulated_payment();

DROP TRIGGER IF EXISTS guard_simulated_remittance_trg ON public.remittance_files;
CREATE TRIGGER guard_simulated_remittance_trg
  BEFORE INSERT OR UPDATE OF is_simulated ON public.remittance_files
  FOR EACH ROW EXECUTE FUNCTION public.guard_simulated_payment();

-- 3. Update recompute_claim_from_payments to never flip a real claim to simulated,
--    and to mark synthetic-only claims as simulated.
CREATE OR REPLACE FUNCTION public.recompute_claim_from_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_claim_id uuid;
  v_sum_paid numeric;
  v_sum_pr numeric;
  v_sum_wo numeric;
  v_last record;
  v_codes text[];
  v_status public.claim_status;
  v_any_real_payment boolean;
  v_any_payment boolean;
  v_claim_currently_simulated boolean;
BEGIN
  v_claim_id := COALESCE(NEW.claim_record_id, OLD.claim_record_id);
  IF v_claim_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(patient_responsibility), 0),
    COALESCE(SUM(write_off), 0),
    bool_or(COALESCE(is_simulated, false) = false),
    count(*) > 0
  INTO v_sum_paid, v_sum_pr, v_sum_wo, v_any_real_payment, v_any_payment
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

  SELECT COALESCE(is_simulated, false) INTO v_claim_currently_simulated
    FROM public.claim_records WHERE id = v_claim_id;

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
      -- Propagate simulated flag: once a claim is real it stays real; an unflagged claim
      -- only becomes simulated when EVERY posted payment is simulated.
      is_simulated                    = CASE
                                          WHEN v_claim_currently_simulated THEN true
                                          WHEN v_any_payment AND NOT v_any_real_payment THEN true
                                          ELSE false
                                        END,
      updated_at                      = now()
  WHERE id = v_claim_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
