DROP POLICY IF EXISTS "cpe_select" ON public.customer_payer_enrollments;
CREATE POLICY "cpe_select" ON public.customer_payer_enrollments
FOR SELECT TO authenticated
USING (
  ((is_billing() OR is_admin() OR is_system_creator()) AND company_id = get_my_company_id())
  OR is_system_creator()
);