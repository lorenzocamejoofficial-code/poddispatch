-- Pass 4A Checkpoint 1, file 2 of 2 (retry 2).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_company_id
  ON public.profiles(active_company_id);

-- Backfill via two CTEs: identify users with exactly 1 membership, then look up their company.
WITH single_users AS (
  SELECT m.user_id
  FROM public.company_memberships m
  JOIN public.companies c ON c.id = m.company_id
  WHERE c.deleted_at IS NULL
  GROUP BY m.user_id
  HAVING count(*) = 1
),
single_membership AS (
  SELECT m.user_id, m.company_id
  FROM public.company_memberships m
  JOIN single_users su ON su.user_id = m.user_id
  JOIN public.companies c ON c.id = m.company_id
  WHERE c.deleted_at IS NULL
)
UPDATE public.profiles p
SET active_company_id = s.company_id
FROM single_membership s
WHERE p.user_id = s.user_id
  AND p.active_company_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH active AS (
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
  fallback AS (
    SELECT m.company_id AS cid
    FROM public.company_memberships m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.user_id = auth.uid()
      AND c.deleted_at IS NULL
      AND (SELECT n FROM member_count) = 1
    LIMIT 1
  )
  SELECT cid FROM active
  UNION ALL
  SELECT cid FROM fallback
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('owner', 'creator', 'manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_billing()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('biller', 'manager', 'owner', 'creator')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_dispatcher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('dispatcher', 'manager', 'owner', 'creator')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_owner_or_creator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid()
      AND company_id = public.get_my_company_id()
      AND role IN ('owner', 'creator')
  )
$$;

DROP POLICY IF EXISTS "Admins update own company" ON public.companies;
CREATE POLICY "Owners update own company"
ON public.companies FOR UPDATE
USING ((id = public.get_my_company_id()) AND public.is_owner_or_creator() AND (deleted_at IS NULL));

DROP POLICY IF EXISTS "Owners can view clearinghouse settings" ON public.clearinghouse_settings;
CREATE POLICY "Owners can view clearinghouse settings"
ON public.clearinghouse_settings FOR SELECT
USING ((company_id = public.get_my_company_id()) AND public.is_owner_or_creator());

DROP POLICY IF EXISTS "Owners can insert clearinghouse settings" ON public.clearinghouse_settings;
CREATE POLICY "Owners can insert clearinghouse settings"
ON public.clearinghouse_settings FOR INSERT
WITH CHECK ((company_id = public.get_my_company_id()) AND public.is_owner_or_creator());

DROP POLICY IF EXISTS "Owners can update clearinghouse settings" ON public.clearinghouse_settings;
CREATE POLICY "Owners can update clearinghouse settings"
ON public.clearinghouse_settings FOR UPDATE
USING ((company_id = public.get_my_company_id()) AND public.is_owner_or_creator())
WITH CHECK ((company_id = public.get_my_company_id()) AND public.is_owner_or_creator());

DROP POLICY IF EXISTS "Admin read own subscription" ON public.subscription_records;
CREATE POLICY "Owner read own subscription"
ON public.subscription_records FOR SELECT
USING (public.is_owner_or_creator() AND (company_id = public.get_my_company_id()));

DROP POLICY IF EXISTS "Owners can read company tickets" ON public.support_tickets;
CREATE POLICY "Owners can read company tickets"
ON public.support_tickets FOR SELECT
USING ((company_id = public.get_my_company_id()) AND public.is_owner_or_creator());

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Owners manage roles"
ON public.user_roles FOR ALL
USING (public.is_owner_or_creator() AND (EXISTS (
  SELECT 1 FROM public.company_memberships cm
  WHERE cm.user_id = user_roles.user_id
    AND cm.company_id = public.get_my_company_id()
)));