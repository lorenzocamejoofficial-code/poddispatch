DROP POLICY IF EXISTS "Members read own company audit logs" ON public.audit_logs;
CREATE POLICY "Billing/admin read company audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_billing() OR public.is_admin()));

DROP POLICY IF EXISTS "Company members read claim_adjustments" ON public.claim_adjustments;
CREATE POLICY "Billing/admin read claim_adjustments"
ON public.claim_adjustments
FOR SELECT
TO authenticated
USING (company_id = public.get_my_company_id() AND (public.is_billing() OR public.is_admin()));

DROP POLICY IF EXISTS "Company members read billing overrides" ON public.billing_overrides;
CREATE POLICY "Billing/admin read billing overrides"
ON public.billing_overrides
FOR SELECT
TO authenticated
USING (
  (public.is_billing() OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.trip_records tr
    WHERE tr.id = billing_overrides.trip_id
      AND tr.company_id = public.get_my_company_id()
  )
);

DROP POLICY IF EXISTS "Crew insert notifications" ON public.notifications;
CREATE POLICY "Members insert allowlisted notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.user_id = notifications.user_id
      AND cm.company_id = public.get_my_company_id()
  )
  AND (
    notifications.user_id = auth.uid()
    OR public.is_admin() OR public.is_dispatcher() OR public.is_billing()
    OR notification_type = ANY (ARRAY[
      'schedule_change',
      'cancellation',
      'crew_handoff',
      'crew_handoff_request',
      'pcr_signature_request',
      'partner_signature_request',
      'incident_alert',
      'emergency_upgrade',
      'run_assigned',
      'run_reassigned',
      'b_leg_ready',
      'ar_assignment',
      'general'
    ])
  )
);