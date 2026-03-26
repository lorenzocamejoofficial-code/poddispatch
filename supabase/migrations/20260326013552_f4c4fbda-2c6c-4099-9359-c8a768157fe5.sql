CREATE POLICY "Admins can insert scheduling legs"
ON public.scheduling_legs
FOR INSERT TO authenticated
WITH CHECK (
  company_id = get_my_company_id()
  AND (is_admin() OR is_dispatcher())
);