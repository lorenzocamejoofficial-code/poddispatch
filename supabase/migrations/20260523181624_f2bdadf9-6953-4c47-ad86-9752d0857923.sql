
-- 1) claim_payments: restrict INSERT to billing/admin/owner/system creator
DROP POLICY IF EXISTS "claim_payments insert scope" ON public.claim_payments;
CREATE POLICY "claim_payments insert scope"
  ON public.claim_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      company_id = public.get_my_company_id()
      AND (public.is_billing() OR public.is_admin() OR public.is_owner_or_creator())
    )
    OR public.is_system_creator()
  );

-- 2) plb_adjustments: restrict INSERT to billing/admin/owner/system creator
DROP POLICY IF EXISTS "plb insert scope" ON public.plb_adjustments;
CREATE POLICY "plb insert scope"
  ON public.plb_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      company_id = public.get_my_company_id()
      AND (public.is_billing() OR public.is_admin() OR public.is_owner_or_creator())
    )
    OR public.is_system_creator()
  );

-- 3) trip_records: remove permissive realtime SELECT that bypasses crew scoping.
-- Realtime postgres_changes still respect the remaining role-scoped policies
-- (Crew read assigned trips, Billing read completed trips, Admins/Dispatchers manage).
DROP POLICY IF EXISTS "realtime_trip_records" ON public.trip_records;

-- 4) crew_share_tokens: stop exposing tokens to unauthenticated callers.
DROP POLICY IF EXISTS "Public read active tokens" ON public.crew_share_tokens;
CREATE POLICY "Authenticated read active tokens"
  ON public.crew_share_tokens
  FOR SELECT
  TO authenticated
  USING (
    active = true
    AND CURRENT_DATE >= valid_from
    AND CURRENT_DATE <= valid_until
  );

-- 5) storage.objects: add missing UPDATE policy for the documents bucket so
-- it has the same company-scoped surface as SELECT/INSERT/DELETE.
DROP POLICY IF EXISTS "Company members update own documents" ON storage.objects;
CREATE POLICY "Company members update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_my_company_id()::text
  );
