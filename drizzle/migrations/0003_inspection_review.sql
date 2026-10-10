ALTER TABLE public.vehicle_inspections
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

GRANT UPDATE ON public.vehicle_inspections TO authenticated;

CREATE POLICY "Dispatch and admins review inspections" ON public.vehicle_inspections
  FOR UPDATE TO authenticated
  USING ((public.is_dispatcher() OR public.is_admin()) AND company_id = public.get_my_company_id())
  WITH CHECK ((public.is_dispatcher() OR public.is_admin()) AND company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Members insert allowlisted notifications" ON public.notifications;
CREATE POLICY "Members insert allowlisted notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM public.company_memberships cm
             WHERE cm.user_id = notifications.user_id AND cm.company_id = public.get_my_company_id()))
    AND ((user_id = auth.uid()) OR public.is_admin() OR public.is_dispatcher() OR public.is_billing()
         OR notification_type = ANY (ARRAY['schedule_change','cancellation','crew_handoff','crew_handoff_request','pcr_signature_request','partner_signature_request','incident_alert','emergency_upgrade','run_assigned','run_reassigned','b_leg_ready','ar_assignment','general','inspection_reviewed']))
  );