
-- Phase 6: proactive alerts (PCS / RSNAT), timely filing for ready_to_bill,
-- and persisted denial categorization.

-- 1. patient_id support on biller_tasks + notifications (for clean dedup)
ALTER TABLE public.biller_tasks
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_biller_tasks_patient_type
  ON public.biller_tasks(patient_id, task_type, status);
CREATE INDEX IF NOT EXISTS idx_notifications_type_patient
  ON public.notifications(notification_type, related_patient_id, created_at);

-- 2. Denial categorization helper (source of truth mirrors denial-code-translations.ts)
CREATE OR REPLACE FUNCTION public.categorize_denial_code(_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE upper(coalesce(_code, ''))
    WHEN 'CO-4'   THEN 'correct_resubmit'
    WHEN 'CO-5'   THEN 'correct_resubmit'
    WHEN 'CO-11'  THEN 'correct_resubmit'
    WHEN 'CO-15'  THEN 'correct_resubmit'
    WHEN 'CO-16'  THEN 'correct_resubmit'
    WHEN 'CO-18'  THEN 'appeal'
    WHEN 'CO-22'  THEN 'followup'
    WHEN 'CO-23'  THEN 'followup'
    WHEN 'CO-26'  THEN 'correct_resubmit'
    WHEN 'CO-27'  THEN 'correct_resubmit'
    WHEN 'CO-29'  THEN 'appeal'
    WHEN 'CO-31'  THEN 'correct_resubmit'
    WHEN 'CO-45'  THEN 'write_off'
    WHEN 'CO-50'  THEN 'appeal'
    WHEN 'CO-55'  THEN 'correct_resubmit'
    WHEN 'CO-56'  THEN 'correct_resubmit'
    WHEN 'CO-96'  THEN 'patient_responsibility'
    WHEN 'CO-97'  THEN 'write_off'
    WHEN 'CO-109' THEN 'correct_resubmit'
    WHEN 'CO-119' THEN 'patient_responsibility'
    WHEN 'CO-167' THEN 'appeal'
    WHEN 'CO-197' THEN 'correct_resubmit'
    WHEN 'CO-204' THEN 'followup'
    WHEN 'PR-1'   THEN 'patient_responsibility'
    WHEN 'PR-2'   THEN 'patient_responsibility'
    WHEN 'PR-3'   THEN 'patient_responsibility'
    WHEN 'PR-26'  THEN 'patient_responsibility'
    WHEN 'PR-27'  THEN 'patient_responsibility'
    WHEN 'PR-96'  THEN 'patient_responsibility'
    WHEN 'OA-18'  THEN 'write_off'
    WHEN 'OA-23'  THEN 'write_off'
    WHEN 'OA-96'  THEN 'write_off'
    WHEN 'N210'   THEN 'appeal'
    WHEN 'N211'   THEN 'write_off'
    WHEN 'N570'   THEN 'correct_resubmit'
    ELSE NULL
  END;
$$;

-- 3. Update recompute trigger to set denial_category on denied claims
CREATE OR REPLACE FUNCTION public.recompute_claim_from_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_new_denial_code text;
  v_new_denial_category text;
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

  SELECT * INTO v_last FROM public.claim_payments
   WHERE claim_record_id = v_claim_id
   ORDER BY applied_at DESC, created_at DESC LIMIT 1;

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

  v_new_denial_code := COALESCE(v_last.denial_code, (SELECT denial_code FROM public.claim_records WHERE id = v_claim_id));
  v_new_denial_category := CASE
    WHEN v_status = 'denied'::public.claim_status AND v_new_denial_code IS NOT NULL
      THEN public.categorize_denial_code(v_new_denial_code)
    ELSE NULL
  END;

  UPDATE public.claim_records
  SET amount_paid                   = v_sum_paid,
      patient_responsibility_amount = NULLIF(v_sum_pr, 0),
      write_off_amount              = NULLIF(v_sum_wo, 0),
      allowed_amount                = COALESCE(v_last.allowed_amount, allowed_amount),
      denial_code                   = COALESCE(v_last.denial_code, denial_code),
      denial_reason                 = COALESCE(v_last.denial_reason, denial_reason),
      denial_category               = COALESCE(v_new_denial_category, denial_category),
      paid_at                       = CASE WHEN v_status = 'paid'::public.claim_status
                                            THEN COALESCE(v_last.payment_date::timestamptz, paid_at)
                                            ELSE paid_at END,
      remittance_date               = COALESCE(v_last.payment_date, remittance_date),
      payer_claim_control_number    = COALESCE(v_last.payer_claim_control_number, payer_claim_control_number),
      adjustment_codes              = v_codes,
      status                        = COALESCE(v_status, status),
      is_simulated                  = CASE
                                        WHEN v_claim_currently_simulated THEN true
                                        WHEN v_any_payment AND NOT v_any_real_payment THEN true
                                        ELSE false
                                      END,
      updated_at                    = now()
  WHERE id = v_claim_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 4. generate_biller_tasks: replace hardcoded denial list with denial_category-driven
--    query; add timely_filing_ready_to_bill bucket.
CREATE OR REPLACE FUNCTION public.generate_biller_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- 14-day follow up
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'follow_up_14', 3,
    'Follow up on submitted claim',
    'Claim submitted ' || (CURRENT_DATE - c.submitted_at::date) || ' days ago with no recent follow-up.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'submitted' AND c.is_simulated = false AND c.submitted_at IS NOT NULL
    AND c.submitted_at::date <= CURRENT_DATE - 14
    AND c.submitted_at::date > CURRENT_DATE - 45
    AND c.company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.ar_followup_notes n WHERE n.claim_id = c.id AND n.created_at > now() - interval '7 days')
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'follow_up_14' AND t.status IN ('pending','in_progress'));

  -- 45-day follow up
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'follow_up_45', 2,
    'Urgent — claim past 45 days with no response',
    'Claim submitted ' || (CURRENT_DATE - c.submitted_at::date) || ' days ago. Requires immediate payer follow-up.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'submitted' AND c.is_simulated = false AND c.submitted_at IS NOT NULL
    AND c.submitted_at::date <= CURRENT_DATE - 45 AND c.company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.ar_followup_notes n WHERE n.claim_id = c.id AND n.created_at > now() - interval '7 days')
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'follow_up_45' AND t.status IN ('pending','in_progress'));

  -- Denial unworked: now driven by denial_category instead of hardcoded code list.
  -- write_off and patient_responsibility are not actionable AR work.
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'denial_unworked', 1,
    'Denied claim needs action',
    'Denied with code ' || COALESCE(c.denial_code, 'unknown') || ' (' || c.denial_category || '). No follow-up in 14 days.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'denied' AND c.is_simulated = false
    AND c.denial_category IS NOT NULL
    AND c.denial_category IN ('appeal','correct_resubmit','followup')
    AND c.company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.ar_followup_notes n WHERE n.claim_id = c.id AND n.created_at > now() - interval '14 days')
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'denial_unworked' AND t.status IN ('pending','in_progress'));

  -- Timely filing risk (submitted/needs_correction)
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'timely_filing_risk', 1,
    'Timely filing deadline approaching',
    'Claim must be resolved by ' || (c.run_date + COALESCE(pd.timely_filing_days, 365)) || ' (' ||
      ((c.run_date + COALESCE(pd.timely_filing_days, 365)) - CURRENT_DATE) || ' days remaining).',
    (c.run_date + COALESCE(pd.timely_filing_days, 365))
  FROM public.claim_records c
  LEFT JOIN LATERAL (SELECT timely_filing_days FROM public.payer_directory pd WHERE pd.company_id = c.company_id AND pd.payer_type = lower(c.payer_type) LIMIT 1) pd ON true
  WHERE c.status IN ('submitted','needs_correction') AND c.is_simulated = false AND c.company_id IS NOT NULL
    AND (c.run_date + COALESCE(pd.timely_filing_days, 365)) - CURRENT_DATE <= 30
    AND (c.run_date + COALESCE(pd.timely_filing_days, 365)) >= CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'timely_filing_risk' AND t.status IN ('pending','in_progress'));

  -- NEW: Unsubmitted (ready_to_bill) approaching filing deadline.
  -- Highest priority — claim hasn't even been transmitted yet.
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'timely_filing_ready_to_bill', 0,
    'Unsubmitted — filing deadline approaching',
    'Ready-to-bill claim with run date ' || c.run_date::text ||
      '. Filing deadline ' || (c.run_date + COALESCE(pd.timely_filing_days, 365)) ||
      ' (' || ((c.run_date + COALESCE(pd.timely_filing_days, 365)) - CURRENT_DATE) || ' days remaining).',
    (c.run_date + COALESCE(pd.timely_filing_days, 365))
  FROM public.claim_records c
  LEFT JOIN LATERAL (SELECT timely_filing_days FROM public.payer_directory pd
                     WHERE pd.company_id = c.company_id AND pd.payer_type = lower(c.payer_type) LIMIT 1) pd ON true
  WHERE c.status = 'ready_to_bill' AND c.is_simulated = false AND c.company_id IS NOT NULL
    AND c.run_date IS NOT NULL
    AND c.payer_type IS NOT NULL
    AND (c.run_date + COALESCE(pd.timely_filing_days, 365)) - CURRENT_DATE <= 30
    AND (c.run_date + COALESCE(pd.timely_filing_days, 365)) >= CURRENT_DATE
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'timely_filing_ready_to_bill' AND t.status IN ('pending','in_progress'));

  -- Missing 999 acknowledgment after 24h
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'no_999_after_24h', 0,
    'Missing acknowledgment — no 999 after 24 hours',
    'Claim submitted ' || ROUND(EXTRACT(EPOCH FROM (now() - c.submitted_at))/3600) || ' hours ago with no 999 acknowledgment. Verify the clearinghouse received the file.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'submitted' AND c.is_simulated = false
    AND c.submitted_at IS NOT NULL AND c.submitted_at < now() - interval '24 hours'
    AND c.acknowledgment_status IS NULL
    AND c.company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'no_999_after_24h' AND t.status IN ('pending','in_progress'));

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_biller_tasks failed: %', SQLERRM;
END;
$function$;

-- 5. PCS expiration alerts (42 CFR 410.40(d) — 60-day window)
CREATE OR REPLACE FUNCTION public.generate_pcs_expiration_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_expiration date;
  v_days_to_exp int;
  v_severity text;
  v_priority int;
  v_msg text;
  v_recipient uuid;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.company_id,
           p.first_name || ' ' || p.last_name AS patient_name,
           p.pcs_signed_date,
           (SELECT MIN(sl.run_date) FROM public.scheduling_legs sl
             WHERE sl.patient_id = p.id AND sl.company_id = p.company_id
               AND sl.run_date >= CURRENT_DATE) AS next_trip_date
    FROM public.patients p
    WHERE p.pcs_on_file = true
      AND p.pcs_signed_date IS NOT NULL
      AND p.deleted_at IS NULL
  LOOP
    IF r.next_trip_date IS NULL THEN CONTINUE; END IF;
    v_expiration := r.pcs_signed_date + 60;

    IF v_expiration < r.next_trip_date THEN
      v_severity := 'critical'; v_priority := 1;
    ELSIF v_expiration - r.next_trip_date <= 14 OR v_expiration - CURRENT_DATE <= 14 THEN
      v_severity := 'warning'; v_priority := 1;
    ELSE
      CONTINUE;
    END IF;

    v_days_to_exp := v_expiration - CURRENT_DATE;
    v_msg := format('PCS %s for %s: signed %s, expires %s (next trip %s).',
      CASE WHEN v_severity='critical' THEN 'EXPIRED' ELSE 'expiring' END,
      r.patient_name, r.pcs_signed_date, v_expiration, r.next_trip_date);

    -- Biller task dedup
    IF NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.patient_id = r.patient_id AND t.task_type = 'pcs_expiring'
        AND t.status IN ('pending','in_progress')
    ) THEN
      INSERT INTO public.biller_tasks (company_id, patient_id, task_type, priority, title, description, due_date)
      VALUES (r.company_id, r.patient_id, 'pcs_expiring', v_priority,
              'PCS ' || v_severity || ' — ' || r.patient_name, v_msg,
              LEAST(v_expiration, r.next_trip_date));
    END IF;

    -- Notifications to billers/managers/owners (7-day dedup per patient)
    FOR v_recipient IN
      SELECT user_id FROM public.company_memberships
       WHERE company_id = r.company_id AND role IN ('owner','creator','manager','biller')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient AND n.notification_type = 'pcs_expiring'
          AND n.related_patient_id = r.patient_id
          AND n.created_at > now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, message, notification_type, related_patient_id)
        VALUES (v_recipient, v_msg, 'pcs_expiring', r.patient_id);
      END IF;
    END LOOP;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_pcs_expiration_alerts failed: %', SQLERRM;
END;
$$;

-- 6. RSNAT prior-auth expiration alerts
CREATE OR REPLACE FUNCTION public.generate_rsnat_auth_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_days_left int;
  v_severity text;
  v_priority int;
  v_msg text;
  v_recipient uuid;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.company_id,
           p.first_name || ' ' || p.last_name AS patient_name,
           p.prior_auth_utn, p.prior_auth_period_end,
           (SELECT MIN(sl.run_date) FROM public.scheduling_legs sl
             WHERE sl.patient_id = p.id AND sl.company_id = p.company_id
               AND sl.run_date >= CURRENT_DATE) AS next_trip_date
    FROM public.patients p
    WHERE p.prior_auth_utn IS NOT NULL
      AND p.prior_auth_period_end IS NOT NULL
      AND p.deleted_at IS NULL
  LOOP
    IF r.next_trip_date IS NULL THEN CONTINUE; END IF;
    v_days_left := r.prior_auth_period_end - CURRENT_DATE;

    IF v_days_left < 0 THEN
      v_severity := 'critical-expired'; v_priority := 1;
    ELSIF v_days_left <= 7 THEN
      v_severity := 'critical'; v_priority := 1;
    ELSIF v_days_left <= 30 THEN
      v_severity := 'warning'; v_priority := 1;
    ELSE
      CONTINUE;
    END IF;

    v_msg := format('RSNAT auth %s for %s (UTN %s): expires %s — %s days, next trip %s.',
      v_severity, r.patient_name, r.prior_auth_utn, r.prior_auth_period_end,
      v_days_left, r.next_trip_date);

    IF NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.patient_id = r.patient_id AND t.task_type = 'auth_expiring'
        AND t.status IN ('pending','in_progress')
    ) THEN
      INSERT INTO public.biller_tasks (company_id, patient_id, task_type, priority, title, description, due_date)
      VALUES (r.company_id, r.patient_id, 'auth_expiring', v_priority,
              'RSNAT auth ' || v_severity || ' — ' || r.patient_name, v_msg,
              GREATEST(CURRENT_DATE, r.prior_auth_period_end));
    END IF;

    FOR v_recipient IN
      SELECT user_id FROM public.company_memberships
       WHERE company_id = r.company_id AND role IN ('owner','creator','manager','biller')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient AND n.notification_type = 'auth_expiring'
          AND n.related_patient_id = r.patient_id
          AND n.created_at > now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, message, notification_type, related_patient_id)
        VALUES (v_recipient, v_msg, 'auth_expiring', r.patient_id);
      END IF;
    END LOOP;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_rsnat_auth_alerts failed: %', SQLERRM;
END;
$$;

-- 7. Combined daily proactive alerts entry point (also emits timely_filing_risk
--    notifications for newly-created ready_to_bill timely filing tasks).
CREATE OR REPLACE FUNCTION public.run_daily_proactive_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
  v_recipient uuid;
BEGIN
  PERFORM public.generate_biller_tasks();
  PERFORM public.generate_pcs_expiration_alerts();
  PERFORM public.generate_rsnat_auth_alerts();

  -- Notify on newly-created timely_filing_ready_to_bill tasks (created today),
  -- 7-day dedup keyed on the claim_id via patient lookup.
  FOR t IN
    SELECT bt.id, bt.company_id, bt.claim_id, bt.description, c.patient_id
      FROM public.biller_tasks bt
      JOIN public.claim_records c ON c.id = bt.claim_id
     WHERE bt.task_type = 'timely_filing_ready_to_bill'
       AND bt.created_at >= now() - interval '1 day'
  LOOP
    FOR v_recipient IN
      SELECT user_id FROM public.company_memberships
       WHERE company_id = t.company_id AND role IN ('owner','creator','manager','biller')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient AND n.notification_type = 'timely_filing_risk'
          AND n.related_patient_id IS NOT DISTINCT FROM t.patient_id
          AND n.created_at > now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, message, notification_type, related_patient_id)
        VALUES (v_recipient, t.description, 'timely_filing_risk', t.patient_id);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
