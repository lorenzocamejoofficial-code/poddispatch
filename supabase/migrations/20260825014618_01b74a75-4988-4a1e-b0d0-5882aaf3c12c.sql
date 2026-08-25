DROP POLICY IF EXISTS "Crew read own cert files" ON storage.objects;
DROP POLICY IF EXISTS "Crew upload own cert files" ON storage.objects;
DROP POLICY IF EXISTS "Crew upload own cert files; admins upload any" ON storage.objects;
DROP POLICY IF EXISTS "Crew update own cert files; admins update any" ON storage.objects;
DROP POLICY IF EXISTS "Crew delete own cert files; admins delete any" ON storage.objects;

CREATE POLICY "cert files: self or same-company manager read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_system_creator()
      OR (
        (public.is_admin() OR public.is_owner_or_creator())
        AND public.is_in_my_company(((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "cert files: self or same-company manager insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_system_creator()
      OR (
        (public.is_admin() OR public.is_owner_or_creator())
        AND public.is_in_my_company(((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "cert files: self or same-company manager update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_system_creator()
      OR (
        (public.is_admin() OR public.is_owner_or_creator())
        AND public.is_in_my_company(((storage.foldername(name))[1])::uuid)
      )
    )
  );

CREATE POLICY "cert files: self or same-company manager delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_system_creator()
      OR (
        (public.is_admin() OR public.is_owner_or_creator())
        AND public.is_in_my_company(((storage.foldername(name))[1])::uuid)
      )
    )
  );