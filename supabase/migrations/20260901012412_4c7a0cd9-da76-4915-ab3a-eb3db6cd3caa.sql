DROP POLICY IF EXISTS "Admins delete certs" ON public.crew_certifications;
CREATE POLICY "Admins delete certs" ON public.crew_certifications
FOR DELETE TO authenticated
USING (
  (is_admin() AND company_id = get_my_company_id())
  OR is_system_creator()
);

DROP POLICY IF EXISTS "Company members can read AFS" ON public.cms_ambulance_fee_schedule;
CREATE POLICY "Company members can read AFS" ON public.cms_ambulance_fee_schedule
FOR SELECT TO authenticated
USING (get_my_company_id() IS NOT NULL OR is_system_creator());

DROP POLICY IF EXISTS "Authenticated can read allowlisted public flags" ON public.creator_settings;
CREATE POLICY "Authenticated can read allowlisted public flags" ON public.creator_settings
FOR SELECT TO authenticated
USING (key = 'maintenance_mode');