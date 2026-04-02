
-- Fix 1: CRITICAL — trip_records realtime policy
DROP POLICY IF EXISTS "realtime_trip_records" ON public.trip_records;
CREATE POLICY "realtime_trip_records" ON public.trip_records
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- Fix 2: HIGH — profiles admin policy
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id());

-- Fix 3: HIGH — leg_exceptions admin policy
DROP POLICY IF EXISTS "Admins manage leg exceptions" ON public.leg_exceptions;
CREATE POLICY "Admins manage leg exceptions" ON public.leg_exceptions
  FOR ALL TO public
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM public.scheduling_legs sl
    WHERE sl.id = leg_exceptions.scheduling_leg_id
      AND sl.company_id = get_my_company_id()
  ));

-- Fix 4: HIGH — crew_share_tokens: add company_id column and fix policy
ALTER TABLE public.crew_share_tokens ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.crew_share_tokens cst
SET company_id = t.company_id
FROM public.trucks t
WHERE cst.truck_id = t.id AND cst.company_id IS NULL;

DROP POLICY IF EXISTS "Admins manage share tokens" ON public.crew_share_tokens;
CREATE POLICY "Admins manage share tokens" ON public.crew_share_tokens
  FOR ALL TO public
  USING (is_admin() AND company_id = get_my_company_id());

-- Fix 5: HIGH — user_roles admin policy
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO public
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.user_id = user_roles.user_id
      AND cm.company_id = get_my_company_id()
  ));

-- Fix 6: MEDIUM — schedule_previews: add company_id and fix policy
ALTER TABLE public.schedule_previews ADD COLUMN IF NOT EXISTS company_id uuid;

DROP POLICY IF EXISTS "Admins manage previews" ON public.schedule_previews;
CREATE POLICY "Admins manage previews" ON public.schedule_previews
  FOR ALL TO public
  USING (is_admin() AND company_id = get_my_company_id());

-- Fix 7: MEDIUM — status_updates admin policy
DROP POLICY IF EXISTS "Admins read status updates" ON public.status_updates;
CREATE POLICY "Admins read status updates" ON public.status_updates
  FOR SELECT TO public
  USING (is_admin() AND EXISTS (
    SELECT 1 FROM public.runs r
    WHERE r.id = status_updates.run_id
      AND r.company_id = get_my_company_id()
  ));
