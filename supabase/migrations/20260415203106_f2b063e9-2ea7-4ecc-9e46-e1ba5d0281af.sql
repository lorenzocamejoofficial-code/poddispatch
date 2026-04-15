
-- Fix vehicle_inspections INSERT policy: remove CURRENT_DATE restriction that breaks across timezones
DROP POLICY IF EXISTS "Crew insert inspections for assigned truck today" ON public.vehicle_inspections;

CREATE POLICY "Crew insert inspections for assigned truck"
ON public.vehicle_inspections
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.truck_id = vehicle_inspections.truck_id
      AND c.active_date = vehicle_inspections.run_date
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

-- Fix vehicle_inspections SELECT policy for crew: remove CURRENT_DATE restriction
DROP POLICY IF EXISTS "Crew read own truck inspections today" ON public.vehicle_inspections;

CREATE POLICY "Crew read own truck inspections"
ON public.vehicle_inspections
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.truck_id = vehicle_inspections.truck_id
      AND c.active_date = vehicle_inspections.run_date
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

-- Fix vehicle_inspection_alerts INSERT policy for crew: remove CURRENT_DATE restriction
DROP POLICY IF EXISTS "Crew insert inspection alerts" ON public.vehicle_inspection_alerts;

CREATE POLICY "Crew insert inspection alerts"
ON public.vehicle_inspection_alerts
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.truck_id = vehicle_inspection_alerts.truck_id
      AND c.active_date = vehicle_inspection_alerts.run_date
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);
