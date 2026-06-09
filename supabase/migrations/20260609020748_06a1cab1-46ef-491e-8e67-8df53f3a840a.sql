-- 1) Remove ambiguous 'creator' tenant role from privileged helper IN-lists.
-- System creators bypass tenant RLS via is_system_creator(); they don't need
-- 'creator' membership role to be treated as owner-tier inside tenant policies.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('owner', 'manager')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_billing()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('biller', 'manager', 'owner')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_dispatcher()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('dispatcher', 'manager', 'owner')
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_owner_or_creator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role = 'owner'
  )
  OR public.is_system_creator()
$function$;

-- 2) Migrate any existing tenant rows that use 'creator' role to 'owner',
-- but ONLY for actual system_creators (their membership row should grant
-- legitimate owner-tier inside the simulation tenant). For non-system-creator
-- rows (shouldn't exist, but defensive) demote to 'manager'.
UPDATE public.company_memberships cm
SET role = 'owner'
WHERE cm.role = 'creator'
  AND EXISTS (SELECT 1 FROM public.system_creators sc WHERE sc.user_id = cm.user_id);

UPDATE public.company_memberships
SET role = 'manager'
WHERE role = 'creator';

-- 3) Update enter_creator_simulation to write 'owner' role instead of 'creator'.
CREATE OR REPLACE FUNCTION public.enter_creator_simulation(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company public.companies%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_system_creator() THEN
    RAISE EXCEPTION 'Only system creators can enter simulation tenants';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = _company_id
    AND deleted_at IS NULL
    AND (creator_test_tenant = true OR is_sandbox = true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulation tenant not available';
  END IF;

  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (_company_id, v_user_id, 'owner'::public.membership_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (user_id, full_name, email, active_company_id, company_id)
  VALUES (
    v_user_id,
    COALESCE((auth.jwt() ->> 'email'), 'System Creator'),
    auth.jwt() ->> 'email',
    _company_id,
    _company_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET active_company_id = EXCLUDED.active_company_id,
      company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
      email = COALESCE(public.profiles.email, EXCLUDED.email);

  RETURN _company_id;
END;
$$;

-- 4) Fix the misleading INSERT policy on remittance_quarantine.
-- service_role bypasses RLS, so the policy isn't needed; drop the broken one
-- and replace with an explicit service_role-scoped policy that matches intent.
DROP POLICY IF EXISTS "Service role can insert quarantine records" ON public.remittance_quarantine;

CREATE POLICY "Service role can insert quarantine records"
ON public.remittance_quarantine
FOR INSERT
TO service_role
WITH CHECK (true);
