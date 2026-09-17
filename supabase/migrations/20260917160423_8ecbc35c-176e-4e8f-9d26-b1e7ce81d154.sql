-- Cross-tenant leak: is_admin() only proves the caller is an admin of SOME company.
-- Without a company_id comparison, an admin at company A could read and update
-- certification rows (medic numbers, licences) belonging to company B.
DROP POLICY IF EXISTS "Users view own certs" ON public.crew_certifications;
CREATE POLICY "Users view own certs"
  ON public.crew_certifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (is_admin() AND company_id = get_my_company_id())
    OR is_system_creator()
  );

DROP POLICY IF EXISTS "Users update own certs; admins update any" ON public.crew_certifications;
CREATE POLICY "Users update own certs; admins update any"
  ON public.crew_certifications
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (is_admin() AND company_id = get_my_company_id())
    OR is_system_creator()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (is_admin() AND company_id = get_my_company_id())
    OR is_system_creator()
  );

-- Within-tenant tamper: any company member could overwrite any other member's
-- uploaded document. Match the DELETE policy's stricter shape.
DROP POLICY IF EXISTS "Company members update own documents" ON storage.objects;
CREATE POLICY "Company members update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
    AND (owner = auth.uid() OR is_admin() OR is_dispatcher() OR is_owner_or_creator())
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (get_my_company_id())::text
    AND (owner = auth.uid() OR is_admin() OR is_dispatcher() OR is_owner_or_creator())
  );