
-- Restrict comms_events policies to authenticated role only
DROP POLICY IF EXISTS "Admins manage comms_events" ON public.comms_events;
DROP POLICY IF EXISTS "Dispatchers read comms_events" ON public.comms_events;
DROP POLICY IF EXISTS "System creator read comms_events" ON public.comms_events;

CREATE POLICY "Admins manage comms_events" ON public.comms_events
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read comms_events" ON public.comms_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read comms_events" ON public.comms_events
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_system_creator());

-- Restrict creator-only audit actions to system creators via a RESTRICTIVE policy
CREATE POLICY "Restrict creator-only audit actions" ON public.audit_logs
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    action NOT IN ('creator_data_reset', 'creator_clear_employees')
    OR is_system_creator()
  );
