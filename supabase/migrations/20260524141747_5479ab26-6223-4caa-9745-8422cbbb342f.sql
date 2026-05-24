
-- 1. billing_overrides
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='billing_overrides' AND cmd='INSERT' LOOP
    EXECUTE format('DROP POLICY %I ON public.billing_overrides', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "Billing/admin can insert billing overrides"
ON public.billing_overrides FOR INSERT TO authenticated
WITH CHECK (
  (public.is_billing() OR public.is_admin() OR public.is_system_creator())
  AND EXISTS (
    SELECT 1 FROM public.trip_records t
    WHERE t.id = billing_overrides.trip_id
      AND t.company_id = public.get_my_company_id()
  )
);

-- 2. audit_logs
DROP POLICY IF EXISTS "Authenticated users can insert company audit logs" ON public.audit_logs;

CREATE POLICY "Members can insert limited audit log entries"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND actor_user_id = auth.uid()
  AND action = ANY (ARRAY[
    'user_login','user_logout','view_phi','export_data',
    'hipaa_acknowledged','password_changed','session_started','session_ended'
  ])
);

-- 3. claim_payments
DROP POLICY IF EXISTS "claim_payments select scope" ON public.claim_payments;
CREATE POLICY "claim_payments select scope"
ON public.claim_payments FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin() OR public.is_system_creator())
);

-- 5. crew_share_tokens
DROP POLICY IF EXISTS "Authenticated read active tokens" ON public.crew_share_tokens;
CREATE POLICY "Authenticated read active company tokens"
ON public.crew_share_tokens FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND COALESCE(active, true) = true
  AND (valid_until IS NULL OR valid_until > now())
);

-- 6. customer_payer_enrollments
DROP POLICY IF EXISTS "cpe_insert" ON public.customer_payer_enrollments;
DROP POLICY IF EXISTS "cpe_update" ON public.customer_payer_enrollments;
DROP POLICY IF EXISTS "cpe_delete" ON public.customer_payer_enrollments;

CREATE POLICY "cpe_insert"
ON public.customer_payer_enrollments FOR INSERT TO authenticated
WITH CHECK (
  (public.is_billing() OR public.is_admin() OR public.is_system_creator())
  AND company_id = public.get_my_company_id()
);

CREATE POLICY "cpe_update"
ON public.customer_payer_enrollments FOR UPDATE TO authenticated
USING (
  (public.is_billing() OR public.is_admin() OR public.is_system_creator())
  AND company_id = public.get_my_company_id()
)
WITH CHECK (
  (public.is_billing() OR public.is_admin() OR public.is_system_creator())
  AND company_id = public.get_my_company_id()
);

CREATE POLICY "cpe_delete"
ON public.customer_payer_enrollments FOR DELETE TO authenticated
USING (
  (public.is_billing() OR public.is_admin() OR public.is_system_creator())
  AND company_id = public.get_my_company_id()
);

-- 7. plb_adjustments
DROP POLICY IF EXISTS "plb select scope" ON public.plb_adjustments;
CREATE POLICY "plb select scope"
ON public.plb_adjustments FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin() OR public.is_system_creator())
);

-- 8. subscription_status_history
DROP POLICY IF EXISTS "Owners can read own company subscription_status_history" ON public.subscription_status_history;
CREATE POLICY "Owners can read own company subscription_status_history"
ON public.subscription_status_history FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_owner_or_creator() OR public.is_system_creator())
);
