
-- 1) vendor_clearinghouse_settings: restrict reads to admins/billers/creators
DROP POLICY IF EXISTS "Authenticated users can read vendor settings" ON public.vendor_clearinghouse_settings;
CREATE POLICY "Privileged users can read vendor settings"
  ON public.vendor_clearinghouse_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_billing() OR public.is_system_creator());

-- 2) notifications: tighten admin INSERT to caller's company members
DROP POLICY IF EXISTS "Admins create notifications" ON public.notifications;
CREATE POLICY "Admins create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = notifications.user_id
        AND cm.company_id = public.get_my_company_id()
    )
  );

-- 3) status_updates: tighten crew INSERT with run+company scoping
DROP POLICY IF EXISTS "Crew insert status" ON public.status_updates;
CREATE POLICY "Crew insert status"
  ON public.status_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = updated_by
    AND EXISTS (
      SELECT 1
      FROM public.runs r
      JOIN public.crews c ON c.id = r.crew_id
      WHERE r.id = status_updates.run_id
        AND r.company_id = public.get_my_company_id()
        AND (
          c.member1_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
          OR c.member3_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
    )
  );

-- 4) write_audit_log: revoke direct EXECUTE from clients
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, text, uuid, jsonb, jsonb, text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, text, uuid, jsonb, jsonb, text) TO service_role;
