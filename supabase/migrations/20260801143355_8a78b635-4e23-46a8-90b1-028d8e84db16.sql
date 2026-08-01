-- 1) Reference data: require a real company context (or system creator)
DROP POLICY IF EXISTS "Authenticated users can read AFS" ON public.cms_ambulance_fee_schedule;
CREATE POLICY "Company members can read AFS"
ON public.cms_ambulance_fee_schedule
FOR SELECT TO authenticated
USING (public.get_my_company_id() IS NOT NULL OR public.is_system_creator());

DROP POLICY IF EXISTS "Authenticated users can read CMS ZIP locality" ON public.cms_zip_locality;
CREATE POLICY "Company members can read CMS ZIP locality"
ON public.cms_zip_locality
FOR SELECT TO authenticated
USING (public.get_my_company_id() IS NOT NULL OR public.is_system_creator());

-- 2) creator_settings: explicit allow-list of publicly readable keys
DROP POLICY IF EXISTS "All authenticated can read public flags" ON public.creator_settings;
CREATE POLICY "Authenticated can read allowlisted public flags"
ON public.creator_settings
FOR SELECT TO authenticated
USING (key = ANY (ARRAY['maintenance_mode'::text]));

-- 3) get_my_company_id(): fail closed for ambiguous multi-membership users
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH creator_bypass AS (
    SELECT p.active_company_id AS cid
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = p.active_company_id
          AND c.creator_test_tenant = TRUE
          AND c.deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.system_creators sc
        WHERE sc.user_id = auth.uid()
      )
    LIMIT 1
  ),
  active AS (
    SELECT p.active_company_id AS cid
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.company_memberships m
        JOIN public.companies c ON c.id = m.company_id
        WHERE m.user_id = auth.uid()
          AND m.company_id = p.active_company_id
          AND c.deleted_at IS NULL
      )
    LIMIT 1
  ),
  member_count AS (
    SELECT count(*) AS n
    FROM public.company_memberships m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.user_id = auth.uid()
      AND c.deleted_at IS NULL
  ),
  -- Only auto-resolve when the user belongs to exactly one live company.
  -- Multi-membership users with no valid active_company_id resolve to NULL
  -- (fail closed) rather than silently landing in an arbitrary tenant.
  fallback AS (
    SELECT m.company_id AS cid
    FROM public.company_memberships m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.user_id = auth.uid()
      AND c.deleted_at IS NULL
      AND (SELECT n FROM member_count) = 1
    LIMIT 1
  )
  SELECT cid FROM creator_bypass
  UNION ALL
  SELECT cid FROM active
  UNION ALL
  SELECT cid FROM fallback
  LIMIT 1;
$function$;

-- Helper: caller is an owner of a specific, resolved company
CREATE OR REPLACE FUNCTION public.is_owner_of_current_company()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_my_company_id() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.company_memberships cm
       WHERE cm.user_id = auth.uid()
         AND cm.company_id = public.get_my_company_id()
         AND cm.role = 'owner'
     );
$function$;

-- Helper: target user is a member of the caller's resolved company
CREATE OR REPLACE FUNCTION public.is_in_my_company(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_my_company_id() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.company_memberships cm
       WHERE cm.user_id = _user_id
         AND cm.company_id = public.get_my_company_id()
     );
$function$;

-- 4) user_roles: strict same-tenant scoping, authenticated only
DROP POLICY IF EXISTS "Owners manage roles" ON public.user_roles;

CREATE POLICY "Owners read roles in their company"
ON public.user_roles
FOR SELECT TO authenticated
USING (public.is_owner_of_current_company() AND public.is_in_my_company(user_id));

CREATE POLICY "Owners grant roles in their company"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.is_owner_of_current_company() AND public.is_in_my_company(user_id));

CREATE POLICY "Owners update roles in their company"
ON public.user_roles
FOR UPDATE TO authenticated
USING (public.is_owner_of_current_company() AND public.is_in_my_company(user_id))
WITH CHECK (public.is_owner_of_current_company() AND public.is_in_my_company(user_id));

CREATE POLICY "Owners revoke roles in their company"
ON public.user_roles
FOR DELETE TO authenticated
USING (public.is_owner_of_current_company() AND public.is_in_my_company(user_id));

CREATE POLICY "System creators manage roles"
ON public.user_roles
FOR ALL TO authenticated
USING (public.is_system_creator())
WITH CHECK (public.is_system_creator());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;