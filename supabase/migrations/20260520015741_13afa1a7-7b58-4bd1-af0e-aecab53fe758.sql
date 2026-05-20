-- Index to make the stuck-pending lookup cheap
CREATE INDEX IF NOT EXISTS idx_claim_submission_queue_pending_attempts
  ON public.claim_submission_queue (status, attempts, created_at)
  WHERE status = 'pending';

-- Extend generate_biller_tasks with queue_stuck_pending detection.
-- Everything before the EXCEPTION clause is unchanged from the 20260519162738
-- migration, with a new INSERT block appended for queue rows stuck >1h.
CREATE OR REPLACE FUNCTION public.generate_biller_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_recipient uuid;
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

  -- Denial unworked (denial_category driven)
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

  -- Ready-to-bill near filing deadline
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

  -- Missing 999 after 24h
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

  -- NEW: Stuck-pending submission-queue rows (worker crashed mid-flight or paused)
  -- One task per company; dedupe by (company_id, task_type) within the open status set.
  FOR r IN
    SELECT q.company_id, COUNT(*) AS stuck_count, MIN(q.created_at) AS oldest
      FROM public.claim_submission_queue q
     WHERE q.status = 'pending'
       AND COALESCE(q.attempts, 0) < 3
       AND q.created_at < now() - interval '1 hour'
       AND q.company_id IS NOT NULL
     GROUP BY q.company_id
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
       WHERE t.company_id = r.company_id
         AND t.task_type = 'queue_stuck_pending'
         AND t.status IN ('pending','in_progress')
    ) THEN
      INSERT INTO public.biller_tasks (company_id, task_type, priority, title, description, due_date)
      VALUES (r.company_id, 'queue_stuck_pending', 0,
              'Submission queue stuck',
              'Submission queue has ' || r.stuck_count || ' row(s) stuck in pending state (oldest ' ||
                ROUND(EXTRACT(EPOCH FROM (now() - r.oldest))/3600, 1) || 'h ago). Worker may need attention.',
              CURRENT_DATE);

      FOR v_recipient IN
        SELECT user_id FROM public.company_memberships
         WHERE company_id = r.company_id AND role IN ('owner','creator','manager','biller')
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = v_recipient
            AND n.notification_type = 'queue_stuck_pending'
            AND n.created_at > now() - interval '1 day'
        ) THEN
          INSERT INTO public.notifications (user_id, message, notification_type)
          VALUES (v_recipient,
                  'Submission queue has rows stuck in pending state. Worker may need attention.',
                  'queue_stuck_pending');
        END IF;
      END LOOP;
    END IF;
  END LOOP;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_biller_tasks failed: %', SQLERRM;
END;
$function$;