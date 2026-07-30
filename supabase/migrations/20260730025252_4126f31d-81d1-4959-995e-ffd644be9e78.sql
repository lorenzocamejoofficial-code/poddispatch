DROP POLICY IF EXISTS "Users insert own certs" ON public.crew_certifications;

CREATE POLICY "Insert own certs or admin for company"
ON public.crew_certifications
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND company_id = public.get_my_company_id())
  OR (company_id = public.get_my_company_id() AND public.is_admin())
  OR public.is_system_creator()
);