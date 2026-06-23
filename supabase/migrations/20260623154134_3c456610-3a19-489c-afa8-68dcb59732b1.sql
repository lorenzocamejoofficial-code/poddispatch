
-- Crew uploads/reads own folder; admins read all
CREATE POLICY "Crew read own cert files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR public.is_system_creator()
    )
  );

CREATE POLICY "Crew upload own cert files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'crew-certifications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Crew update own cert files; admins update any"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR public.is_system_creator()
    )
  );

CREATE POLICY "Crew delete own cert files; admins delete any"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'crew-certifications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR public.is_system_creator()
    )
  );
