-- 1. Remove legacy unused sftp_password_encrypted column from clearinghouse_settings.
-- The actual SFTP password lives in the server-only clearinghouse_credentials table
-- and is never exposed to clients. The column on clearinghouse_settings was
-- never read by any code and was readable by all company owners via the SELECT
-- policy on that table.
ALTER TABLE public.clearinghouse_settings DROP COLUMN IF EXISTS sftp_password_encrypted;

-- 2. admin_actions: make the deny-by-default for writes explicit so intent is
-- audit-visible. Inserts are still performed by edge functions running with the
-- service role (which bypasses RLS). No authenticated/anon role may write or
-- mutate audit rows from the client.
DROP POLICY IF EXISTS "Deny client writes to admin_actions" ON public.admin_actions;
CREATE POLICY "Deny client writes to admin_actions"
ON public.admin_actions
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
-- Re-allow the existing SELECT for system creators (RESTRICTIVE policy above
-- blocks writes via false USING; SELECT is still permitted by the existing
-- PERMISSIVE "System creator reads admin actions" policy because RESTRICTIVE
-- on SELECT would also block reads. We scoped FOR ALL with USING(false), which
-- would block SELECT too -> fix by scoping to write commands only).
DROP POLICY IF EXISTS "Deny client writes to admin_actions" ON public.admin_actions;
CREATE POLICY "Deny client insert admin_actions" ON public.admin_actions
  AS RESTRICTIVE FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Deny client update admin_actions" ON public.admin_actions
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny client delete admin_actions" ON public.admin_actions
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- 3. audit-exports storage bucket: explicit deny for INSERT/UPDATE/DELETE from
-- clients so the immutability intent (mirroring is_sealed on audit_exports
-- rows) is enforceable and auditable. The service role still writes sealed
-- files via edge functions.
DROP POLICY IF EXISTS "Deny client insert audit-exports" ON storage.objects;
CREATE POLICY "Deny client insert audit-exports" ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id <> 'audit-exports');

DROP POLICY IF EXISTS "Deny client update audit-exports" ON storage.objects;
CREATE POLICY "Deny client update audit-exports" ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (bucket_id <> 'audit-exports')
  WITH CHECK (bucket_id <> 'audit-exports');

DROP POLICY IF EXISTS "Deny client delete audit-exports" ON storage.objects;
CREATE POLICY "Deny client delete audit-exports" ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (bucket_id <> 'audit-exports');
