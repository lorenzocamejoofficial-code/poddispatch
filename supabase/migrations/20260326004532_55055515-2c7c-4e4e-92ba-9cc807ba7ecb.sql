CREATE POLICY "System creator reads all billing overrides"
ON public.billing_overrides
FOR SELECT
TO authenticated
USING (is_system_creator());