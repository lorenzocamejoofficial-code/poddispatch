DROP POLICY IF EXISTS "Crew upload own cert files" ON storage.objects;

CREATE POLICY "Crew upload own cert files; admins upload any"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR public.is_owner_or_creator()
      OR public.is_system_creator()
    )
  );