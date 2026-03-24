
-- 1. Create schedule_change_log table
CREATE TABLE public.schedule_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  truck_id uuid REFERENCES public.trucks(id),
  leg_id uuid REFERENCES public.scheduling_legs(id),
  change_type text NOT NULL,
  change_summary text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid NOT NULL REFERENCES public.profiles(id),
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read schedule_change_log"
  ON public.schedule_change_log FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Company members insert schedule_change_log"
  ON public.schedule_change_log FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id());

CREATE POLICY "System creator read schedule_change_log"
  ON public.schedule_change_log FOR SELECT TO authenticated
  USING (public.is_system_creator());

-- 2. Add columns to notifications table
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS notification_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS related_run_id uuid;
