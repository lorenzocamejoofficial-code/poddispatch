
-- 1) RPC: retry claim creation for a trip (re-fires auto_create_claim_on_pcr_submit)
CREATE OR REPLACE FUNCTION public.retry_claim_creation(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_trip public.trip_records%ROWTYPE;
BEGIN
  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;
  v_company_id := public.get_my_company_id();
  SELECT * INTO v_trip FROM public.trip_records WHERE id = p_trip_id AND company_id = v_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TRIP_NOT_FOUND');
  END IF;
  IF v_trip.pcr_status IS DISTINCT FROM 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PCR_NOT_SUBMITTED');
  END IF;
  -- Force re-fire by flipping pcr_status then restoring
  UPDATE public.trip_records SET pcr_status = 'draft' WHERE id = p_trip_id;
  UPDATE public.trip_records SET pcr_status = 'submitted' WHERE id = p_trip_id;
  -- Mark failures resolved (the trigger will re-insert if it fails again)
  UPDATE public.claim_creation_failures
    SET resolved_at = now(), resolved_by = auth.uid()
    WHERE trip_id = p_trip_id AND resolved_at IS NULL;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 2) RPC: dismiss a claim_creation_failure without retry
CREATE OR REPLACE FUNCTION public.dismiss_claim_creation_failure(p_failure_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;
  v_company_id := public.get_my_company_id();
  UPDATE public.claim_creation_failures
    SET resolved_at = now(), resolved_by = auth.uid()
    WHERE id = p_failure_id AND company_id = v_company_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3) Allow billers/admins to UPDATE claim_creation_failures (for dismiss/resolve)
DROP POLICY IF EXISTS "billers_update_failures" ON public.claim_creation_failures;
CREATE POLICY "billers_update_failures" ON public.claim_creation_failures
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND (public.is_billing() OR public.is_admin()))
  WITH CHECK (company_id = public.get_my_company_id());

-- 4) RPC: force retry / cancel a claim_submission_queue row
CREATE OR REPLACE FUNCTION public.force_retry_submission_queue(p_queue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;
  v_company_id := public.get_my_company_id();
  UPDATE public.claim_submission_queue
    SET status = 'pending', attempts = 0, error_message = NULL, updated_at = now()
    WHERE id = p_queue_id AND company_id = v_company_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_submission_queue(p_queue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;
  v_company_id := public.get_my_company_id();
  UPDATE public.claim_submission_queue
    SET status = 'failed', error_message = COALESCE(error_message,'') || ' [cancelled by user]', updated_at = now()
    WHERE id = p_queue_id AND company_id = v_company_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5) Add UPDATE policy on claim_submission_queue for billers
DROP POLICY IF EXISTS "billers_update_queue" ON public.claim_submission_queue;
CREATE POLICY "billers_update_queue" ON public.claim_submission_queue
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id() AND (public.is_billing() OR public.is_admin()))
  WITH CHECK (company_id = public.get_my_company_id());

-- 6) Extend generate_biller_tasks with no_999_after_24h check
CREATE OR REPLACE FUNCTION public.generate_biller_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- (existing checks 1-4 unchanged)
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

  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT c.company_id, c.id, 'denial_unworked', 1,
    'Denied claim needs action',
    'Denied with code ' || COALESCE(c.denial_code, 'unknown') || '. No follow-up in 14 days.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'denied' AND c.is_simulated = false AND c.denial_code IS NOT NULL AND c.company_id IS NOT NULL
    AND c.denial_code IN ('CO-4','CO-16','CO-18','CO-22','CO-27','CO-29','CO-31','CO-32','CO-45','CO-50','CO-97','CO-109','CO-119','CO-125','CO-167','CO-197','CO-252','CO-256','OA-18','OA-23','PR-1','PR-2','PR-3','PR-96','PR-204','N20','N30','N290','N362','N386','N432','N517','N657','MA18','MA36','MA61','MA130','M62')
    AND NOT EXISTS (SELECT 1 FROM public.ar_followup_notes n WHERE n.claim_id = c.id AND n.created_at > now() - interval '14 days')
    AND NOT EXISTS (SELECT 1 FROM public.biller_tasks t WHERE t.claim_id = c.id AND t.task_type = 'denial_unworked' AND t.status IN ('pending','in_progress'));

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

  -- NEW: no_999_after_24h — submitted >24h ago, no acknowledgment recorded
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
$$;

-- 7) Trigger: insert biller notifications when a claim is rejected via 999/277CA
CREATE OR REPLACE FUNCTION public.notify_billers_on_claim_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claim public.claim_records%ROWTYPE;
  v_patient_name text := 'patient';
  v_msg text;
  v_short_id text;
BEGIN
  IF NEW.outcome <> 'rejected' OR NEW.claim_record_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_claim FROM public.claim_records WHERE id = NEW.claim_record_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_claim.patient_id IS NOT NULL THEN
    SELECT COALESCE(first_name || ' ' || last_name, 'patient') INTO v_patient_name
      FROM public.patients WHERE id = v_claim.patient_id;
  END IF;

  v_short_id := substring(v_claim.id::text, 1, 8);
  v_msg := 'Claim ' || v_short_id || ' for ' || COALESCE(v_patient_name, 'patient') ||
    ' was rejected at ' ||
    CASE WHEN NEW.file_type = '999' THEN 'clearinghouse (999)' ELSE 'payer (277CA)' END ||
    ' — ' || COALESCE(NULLIF(NEW.rejection_reason, ''), 'see claim detail') || '. Click to review.';

  INSERT INTO public.notifications (user_id, message, notification_type)
  SELECT m.user_id, v_msg, 'claim_rejection'
  FROM public.company_memberships m
  WHERE m.company_id = COALESCE(NEW.company_id, v_claim.company_id)
    AND m.role IN ('biller','manager','owner','creator');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_billers_on_claim_rejection failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_billers_on_claim_rejection ON public.claim_acknowledgments;
CREATE TRIGGER trg_notify_billers_on_claim_rejection
  AFTER INSERT ON public.claim_acknowledgments
  FOR EACH ROW EXECUTE FUNCTION public.notify_billers_on_claim_rejection();

-- 8) Allow billers/managers/owners/creators to receive notifications inserted by trigger.
-- The trigger runs as SECURITY DEFINER so it bypasses RLS for insert. No policy change needed for SELECT —
-- billers already read their own notifications via existing "Users read own notifications" policy.
