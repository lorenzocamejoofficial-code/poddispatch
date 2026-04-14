
-- Create biller_tasks table
CREATE TABLE public.biller_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claim_records(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trip_records(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 3,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  dismiss_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_biller_tasks_company_status ON public.biller_tasks(company_id, status);
CREATE INDEX idx_biller_tasks_claim_type ON public.biller_tasks(claim_id, task_type, status);

-- Enable RLS
ALTER TABLE public.biller_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing users can view biller tasks"
ON public.biller_tasks FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id() AND public.is_billing());

CREATE POLICY "Billing users can create biller tasks"
ON public.biller_tasks FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_my_company_id() AND public.is_billing());

CREATE POLICY "Billing users can update biller tasks"
ON public.biller_tasks FOR UPDATE TO authenticated
USING (company_id = public.get_my_company_id() AND public.is_billing())
WITH CHECK (company_id = public.get_my_company_id() AND public.is_billing());

-- Updated_at trigger
CREATE TRIGGER update_biller_tasks_updated_at
BEFORE UPDATE ON public.biller_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- The generate_biller_tasks function
CREATE OR REPLACE FUNCTION public.generate_biller_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check 1: follow_up_14 (submitted 14-44 days, no recent note)
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT
    c.company_id,
    c.id,
    'follow_up_14',
    3,
    'Follow up on submitted claim',
    'Claim submitted ' || (CURRENT_DATE - c.submitted_at::date) || ' days ago with no recent follow-up.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'submitted'
    AND c.is_simulated = false
    AND c.submitted_at IS NOT NULL
    AND c.submitted_at::date <= CURRENT_DATE - 14
    AND c.submitted_at::date > CURRENT_DATE - 45
    AND c.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ar_followup_notes n
      WHERE n.claim_id = c.id AND n.created_at > now() - interval '7 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.claim_id = c.id AND t.task_type = 'follow_up_14' AND t.status IN ('pending', 'in_progress')
    );

  -- Check 2: follow_up_45 (submitted 45+ days, no recent note)
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT
    c.company_id,
    c.id,
    'follow_up_45',
    2,
    'Urgent — claim past 45 days with no response',
    'Claim submitted ' || (CURRENT_DATE - c.submitted_at::date) || ' days ago. Requires immediate payer follow-up.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'submitted'
    AND c.is_simulated = false
    AND c.submitted_at IS NOT NULL
    AND c.submitted_at::date <= CURRENT_DATE - 45
    AND c.company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ar_followup_notes n
      WHERE n.claim_id = c.id AND n.created_at > now() - interval '7 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.claim_id = c.id AND t.task_type = 'follow_up_45' AND t.status IN ('pending', 'in_progress')
    );

  -- Check 3: denial_unworked (denied, recoverable, no recent action)
  -- We check for common recoverable denial codes inline
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT
    c.company_id,
    c.id,
    'denial_unworked',
    1,
    'Denied claim needs action',
    'Denied with code ' || COALESCE(c.denial_code, 'unknown') || '. No follow-up in 14 days.',
    CURRENT_DATE
  FROM public.claim_records c
  WHERE c.status = 'denied'
    AND c.is_simulated = false
    AND c.denial_code IS NOT NULL
    AND c.company_id IS NOT NULL
    AND c.denial_code IN (
      'CO-4', 'CO-16', 'CO-18', 'CO-22', 'CO-27', 'CO-29', 'CO-31', 'CO-32',
      'CO-45', 'CO-50', 'CO-97', 'CO-109', 'CO-119', 'CO-125', 'CO-167', 'CO-197',
      'CO-252', 'CO-256', 'OA-18', 'OA-23', 'PR-1', 'PR-2', 'PR-3', 'PR-96',
      'PR-204', 'N20', 'N30', 'N290', 'N362', 'N386', 'N432', 'N517', 'N657',
      'MA18', 'MA36', 'MA61', 'MA130', 'M62'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ar_followup_notes n
      WHERE n.claim_id = c.id AND n.created_at > now() - interval '14 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.claim_id = c.id AND t.task_type = 'denial_unworked' AND t.status IN ('pending', 'in_progress')
    );

  -- Check 4: timely_filing_risk (within 30 days of filing limit)
  INSERT INTO public.biller_tasks (company_id, claim_id, task_type, priority, title, description, due_date)
  SELECT
    c.company_id,
    c.id,
    'timely_filing_risk',
    1,
    'Timely filing deadline approaching',
    'Claim must be resolved by ' || (c.run_date + COALESCE(pd.timely_filing_days, 365)) || ' (' ||
      ((c.run_date + COALESCE(pd.timely_filing_days, 365)) - CURRENT_DATE) || ' days remaining).',
    (c.run_date + COALESCE(pd.timely_filing_days, 365))
  FROM public.claim_records c
  LEFT JOIN LATERAL (
    SELECT timely_filing_days FROM public.payer_directory pd
    WHERE pd.company_id = c.company_id
      AND pd.payer_type = lower(c.payer_type)
    LIMIT 1
  ) pd ON true
  WHERE c.status IN ('submitted', 'needs_correction')
    AND c.is_simulated = false
    AND c.company_id IS NOT NULL
    AND (c.run_date + COALESCE(pd.timely_filing_days, 365)) - CURRENT_DATE <= 30
    AND (c.run_date + COALESCE(pd.timely_filing_days, 365)) >= CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.claim_id = c.id AND t.task_type = 'timely_filing_risk' AND t.status IN ('pending', 'in_progress')
    );

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_biller_tasks failed: %', SQLERRM;
END;
$$;
