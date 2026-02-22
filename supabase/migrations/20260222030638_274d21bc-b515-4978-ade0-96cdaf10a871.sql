
-- 1. Create membership_role enum
CREATE TYPE public.membership_role AS ENUM ('creator', 'owner', 'dispatcher', 'biller', 'crew');

-- 2. Create company_memberships table
CREATE TABLE public.company_memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role membership_role NOT NULL DEFAULT 'crew',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
-- Users can read their own memberships
CREATE POLICY "Users read own memberships"
  ON public.company_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Owners/creators can manage memberships in their company
CREATE POLICY "Owners manage company memberships"
  ON public.company_memberships FOR ALL
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'creator')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'creator')
    )
  );

-- System creator can read all
CREATE POLICY "System creator read all memberships"
  ON public.company_memberships FOR SELECT
  USING (is_system_creator());

-- 5. Migrate existing data: user_roles + profiles -> company_memberships
INSERT INTO public.company_memberships (company_id, user_id, role)
SELECT
  p.company_id,
  p.user_id,
  CASE ur.role::text
    WHEN 'admin' THEN 'owner'::membership_role
    WHEN 'billing' THEN 'biller'::membership_role
    WHEN 'dispatcher' THEN 'dispatcher'::membership_role
    WHEN 'crew' THEN 'crew'::membership_role
  END
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE p.company_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 6. Promote system creators to 'creator' role
UPDATE public.company_memberships cm
SET role = 'creator'
FROM public.system_creators sc
WHERE cm.user_id = sc.user_id;

-- 7. Update get_my_company_id() to read from company_memberships
CREATE OR REPLACE FUNCTION public.get_my_company_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- 8. Create helper: get my membership role
CREATE OR REPLACE FUNCTION public.get_my_role()
  RETURNS text
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT role::text FROM public.company_memberships WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- 9. Update is_admin() to check for owner or creator
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'creator')
  )
$function$;

-- 10. Update is_dispatcher()
CREATE OR REPLACE FUNCTION public.is_dispatcher()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid() AND role IN ('dispatcher', 'owner', 'creator')
  )
$function$;

-- 11. Update is_billing()
CREATE OR REPLACE FUNCTION public.is_billing()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = auth.uid() AND role IN ('biller', 'owner', 'creator')
  )
$function$;

-- 12. Update has_role to work with new system
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE user_id = _user_id AND (
      role::text = _role::text
      OR (_role::text = 'admin' AND role IN ('owner', 'creator'))
      OR (_role::text = 'billing' AND role::text = 'biller')
    )
  )
$function$;

-- 13. Index for performance
CREATE INDEX idx_company_memberships_user ON public.company_memberships(user_id);
CREATE INDEX idx_company_memberships_company ON public.company_memberships(company_id);
