-- Tighten billing_overrides INSERT policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can insert billing overrides" ON public.billing_overrides;
CREATE POLICY "Authenticated users can insert billing overrides"
  ON public.billing_overrides
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Also tighten SELECT to authenticated only (already set but let's be explicit)
DROP POLICY IF EXISTS "Authenticated users can read billing overrides" ON public.billing_overrides;
CREATE POLICY "Authenticated users can read billing overrides"
  ON public.billing_overrides
  FOR SELECT
  TO authenticated
  USING (true);