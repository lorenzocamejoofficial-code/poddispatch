-- Allow system creators to read recovery attempt logs for security monitoring
CREATE POLICY "System creators can view recovery attempts"
ON public.creator_recovery_attempts
FOR SELECT
TO authenticated
USING (public.is_system_creator());

-- Allow company billers/admins to view & resolve their own quarantined remittance records
CREATE POLICY "Billers can view their company's quarantined remittances"
ON public.remittance_quarantine
FOR SELECT
TO authenticated
USING (
  matched_company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin())
);

CREATE POLICY "Billers can update their company's quarantined remittances"
ON public.remittance_quarantine
FOR UPDATE
TO authenticated
USING (
  matched_company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin())
)
WITH CHECK (
  matched_company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin())
);