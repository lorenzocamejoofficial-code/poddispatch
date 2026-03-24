-- Allow crew members to INSERT alerts scoped to their own company
CREATE POLICY "Crew insert alerts"
ON public.alerts
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_my_company_id());

-- Allow crew members to INSERT notifications
CREATE POLICY "Crew insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);