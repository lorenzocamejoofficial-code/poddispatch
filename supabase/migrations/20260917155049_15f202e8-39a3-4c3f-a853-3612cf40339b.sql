-- System creators need read access to onboarding progress for the company health table.
-- Without this the creator query returns zero rows and every company renders "Not Started".
CREATE POLICY "System creator read migration_settings"
ON public.migration_settings
FOR SELECT
TO authenticated
USING (public.is_system_creator());