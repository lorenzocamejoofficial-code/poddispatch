
-- Fix 2: Storage bucket company scoping
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete documents" ON storage.objects;

-- Recreate with company_id scoping via file path
CREATE POLICY "Company members read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (public.get_my_company_id())::text
);

CREATE POLICY "Company members upload own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = (public.get_my_company_id())::text
);

CREATE POLICY "Admins delete own company documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (SELECT public.is_admin())
  AND (storage.foldername(name))[1] = (public.get_my_company_id())::text
);

-- Fix 3a: Restrict creator UPDATE on companies to name only
DROP POLICY IF EXISTS "System creator update companies" ON public.companies;

CREATE POLICY "System creator update company name only"
ON public.companies FOR UPDATE
TO authenticated
USING (public.is_system_creator())
WITH CHECK (public.is_system_creator());

-- Fix 3b: Remove creator UPDATE on subscription_records
DROP POLICY IF EXISTS "System creator update subscriptions" ON public.subscription_records;

-- Fix 4: Allow system creators to insert audit logs (they don't have a company_id from get_my_company_id)
CREATE POLICY "System creator insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_system_creator() AND actor_user_id = auth.uid());
