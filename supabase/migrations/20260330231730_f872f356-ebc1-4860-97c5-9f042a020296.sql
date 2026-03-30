CREATE POLICY "Company members read company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (company_id = get_my_company_id());