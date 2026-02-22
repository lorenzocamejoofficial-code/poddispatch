
-- Fix infinite recursion: create a SECURITY DEFINER function to check ownership
CREATE OR REPLACE FUNCTION public.is_company_owner_or_creator(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = _company_id
      AND role IN ('owner', 'creator')
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Owners manage company memberships" ON public.company_memberships;

-- Recreate without self-referencing query
CREATE POLICY "Owners manage company memberships"
ON public.company_memberships
FOR ALL
USING (public.is_company_owner_or_creator(company_id))
WITH CHECK (public.is_company_owner_or_creator(company_id));
