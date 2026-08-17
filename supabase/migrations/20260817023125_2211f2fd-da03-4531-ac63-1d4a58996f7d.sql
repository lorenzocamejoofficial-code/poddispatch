DROP POLICY IF EXISTS "Crew insert alerts" ON public.alerts;
CREATE POLICY "Crew insert alerts" ON public.alerts
FOR INSERT TO authenticated
WITH CHECK (
  company_id = get_my_company_id()
  AND (
    is_admin()
    OR is_dispatcher()
    OR is_owner_or_creator()
    OR (truck_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.crews c
      WHERE c.truck_id = alerts.truck_id
        AND (
          c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        )
    ))
  )
);

DROP POLICY IF EXISTS "Crew insert incident_reports" ON public.incident_reports;
CREATE POLICY "Crew insert incident_reports" ON public.incident_reports
FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() AND submitted_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated insert document_attachments" ON public.document_attachments;
CREATE POLICY "Authenticated insert document_attachments" ON public.document_attachments
FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id() AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Company members insert schedule_change_log" ON public.schedule_change_log;
CREATE POLICY "Company members insert schedule_change_log" ON public.schedule_change_log
FOR INSERT TO authenticated
WITH CHECK (
  company_id = get_my_company_id()
  AND changed_by = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated read active company tokens" ON public.crew_share_tokens;
CREATE POLICY "Authenticated read active company tokens" ON public.crew_share_tokens
FOR SELECT TO authenticated
USING (
  company_id = get_my_company_id()
  AND (is_admin() OR is_dispatcher() OR is_owner_or_creator())
  AND COALESCE(active, true) = true
  AND (valid_until IS NULL OR valid_until > now())
);