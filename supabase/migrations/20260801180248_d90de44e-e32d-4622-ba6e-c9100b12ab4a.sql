DROP POLICY IF EXISTS "Authenticated can read founding counter" ON public.founding_counter;

CREATE POLICY "System creators can read founding counter"
ON public.founding_counter
FOR SELECT
TO authenticated
USING (public.is_system_creator());

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.company_memberships
  WHERE user_id = auth.uid()
    AND company_id = public.get_my_company_id()
  LIMIT 1;
$$;