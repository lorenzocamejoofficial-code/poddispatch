
-- Fix the RLS policy to be permissive (not restrictive)
DROP POLICY IF EXISTS "System creators read own" ON public.system_creators;
CREATE POLICY "System creators read own"
ON public.system_creators
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- System creator needs cross-company read access for anonymized metrics
-- Add SELECT policies for system creators on aggregate tables
CREATE POLICY "System creator read companies"
ON public.companies FOR SELECT TO authenticated
USING (is_system_creator());

CREATE POLICY "System creator read profiles count"
ON public.profiles FOR SELECT TO authenticated
USING (is_system_creator());

CREATE POLICY "System creator read trucks count"
ON public.trucks FOR SELECT TO authenticated
USING (is_system_creator());

CREATE POLICY "System creator read trips"
ON public.trip_records FOR SELECT TO authenticated
USING (is_system_creator());

CREATE POLICY "System creator read claims"
ON public.claim_records FOR SELECT TO authenticated
USING (is_system_creator());
