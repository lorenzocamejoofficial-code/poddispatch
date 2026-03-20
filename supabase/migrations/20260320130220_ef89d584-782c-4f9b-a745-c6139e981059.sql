
-- Fix audit_logs INSERT policy: replace WITH CHECK (true) with proper auth check
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Fix billing_overrides: tighten INSERT to require company membership
-- The current policy allows any authenticated user to insert overrides for any company's trips
DROP POLICY IF EXISTS "Authenticated users can insert billing overrides" ON public.billing_overrides;
CREATE POLICY "Billing users can insert billing overrides"
ON public.billing_overrides
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.trip_records tr
    WHERE tr.id = trip_id
      AND tr.company_id = public.get_my_company_id()
  )
);

-- Fix billing_overrides: tighten SELECT to company scope
DROP POLICY IF EXISTS "Authenticated users can read billing overrides" ON public.billing_overrides;
CREATE POLICY "Company members read billing overrides"
ON public.billing_overrides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trip_records tr
    WHERE tr.id = trip_id
      AND tr.company_id = public.get_my_company_id()
  )
);

-- Fix leg_exceptions: tighten SELECT from USING (true) to company-scoped
DROP POLICY IF EXISTS "Crew read leg exceptions" ON public.leg_exceptions;
CREATE POLICY "Company members read leg exceptions"
ON public.leg_exceptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.scheduling_legs sl
    WHERE sl.id = scheduling_leg_id
      AND sl.company_id = public.get_my_company_id()
  )
);
