-- Pass 4D — 5 RLS policy fixes

-- ============================================================
-- #2 legal_acceptances — tighten INSERT
-- ============================================================
DROP POLICY IF EXISTS "Users can insert their own legal acceptances" ON public.legal_acceptances;
DROP POLICY IF EXISTS "legal_acceptances_insert" ON public.legal_acceptances;
DROP POLICY IF EXISTS "Insert own legal acceptances" ON public.legal_acceptances;

CREATE POLICY "legal_acceptances_insert_own_scoped"
ON public.legal_acceptances
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (company_id IS NULL OR company_id = public.get_my_company_id())
);

-- ============================================================
-- #3 claim_payments — drop UPDATE + DELETE entirely (insert-only)
-- ============================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'claim_payments'
      AND cmd IN ('UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.claim_payments', p.policyname);
  END LOOP;
END $$;

-- ============================================================
-- #4 plb_adjustments — drop UPDATE + DELETE entirely (insert-only)
-- ============================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plb_adjustments'
      AND cmd IN ('UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.plb_adjustments', p.policyname);
  END LOOP;
END $$;

-- ============================================================
-- #5 companies — drop misnamed "creator update name only" policy
-- (RLS cannot enforce column-level allowlists; verified_by writes
--  will be moved to a service-role edge function: mark-company-verified)
-- ============================================================
DROP POLICY IF EXISTS "System creator update company name only" ON public.companies;
DROP POLICY IF EXISTS "System creators can update company name only" ON public.companies;
DROP POLICY IF EXISTS "system_creator_update_company_name_only" ON public.companies;

-- ============================================================
-- #6 profiles — replace broad ALL admin policy with per-cmd policies
-- ============================================================

-- Helper function
CREATE OR REPLACE FUNCTION public.is_user_owner_of_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role IN ('owner', 'creator')
  )
$$;

-- Drop the old broad ALL admin policy (try common naming)
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins_manage_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Per-cmd replacements
CREATE POLICY "profiles_admin_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND company_id = public.get_my_company_id()
);

CREATE POLICY "profiles_admin_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  AND company_id = public.get_my_company_id()
  AND (
    public.is_owner_or_creator()
    OR NOT public.is_user_owner_of_company(user_id, public.get_my_company_id())
  )
)
WITH CHECK (
  public.is_admin()
  AND company_id = public.get_my_company_id()
  AND (
    public.is_owner_or_creator()
    OR NOT public.is_user_owner_of_company(user_id, public.get_my_company_id())
  )
);

CREATE POLICY "profiles_owner_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_owner_or_creator()
  AND company_id = public.get_my_company_id()
);
