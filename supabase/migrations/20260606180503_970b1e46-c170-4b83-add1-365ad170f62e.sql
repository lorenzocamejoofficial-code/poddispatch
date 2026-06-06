
-- 1. clearinghouse_ack_files — explicit deny on writes for authenticated/anon.
--    These are service-role-only tables (populated by ingest-acks-officeally edge function).
--    SELECT policy for system_creators is unchanged.
DROP POLICY IF EXISTS "Deny ack file inserts" ON public.clearinghouse_ack_files;
DROP POLICY IF EXISTS "Deny ack file updates" ON public.clearinghouse_ack_files;
DROP POLICY IF EXISTS "Deny ack file deletes" ON public.clearinghouse_ack_files;

CREATE POLICY "Deny ack file inserts"
  ON public.clearinghouse_ack_files
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny ack file updates"
  ON public.clearinghouse_ack_files
  FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny ack file deletes"
  ON public.clearinghouse_ack_files
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- 2. storage.objects policies scoped to the email-assets bucket.
--    Bucket is private; only system creators (and service role) get access.
DROP POLICY IF EXISTS "email-assets system creators select" ON storage.objects;
DROP POLICY IF EXISTS "email-assets system creators insert" ON storage.objects;
DROP POLICY IF EXISTS "email-assets system creators update" ON storage.objects;
DROP POLICY IF EXISTS "email-assets system creators delete" ON storage.objects;

CREATE POLICY "email-assets system creators select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'email-assets' AND public.is_system_creator());

CREATE POLICY "email-assets system creators insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'email-assets' AND public.is_system_creator());

CREATE POLICY "email-assets system creators update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'email-assets' AND public.is_system_creator())
  WITH CHECK (bucket_id = 'email-assets' AND public.is_system_creator());

CREATE POLICY "email-assets system creators delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'email-assets' AND public.is_system_creator());
