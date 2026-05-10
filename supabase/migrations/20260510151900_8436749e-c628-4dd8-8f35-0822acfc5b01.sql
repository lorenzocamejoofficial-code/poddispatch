-- Add policy allowing admin-tier users (owner, creator, manager) to read all memberships within their current company
CREATE POLICY "Admin tier reads company memberships"
ON public.company_memberships
FOR SELECT
TO authenticated
USING (public.is_admin() AND company_id = public.get_my_company_id());