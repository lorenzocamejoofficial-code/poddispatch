-- 1) billing_overrides: add denormalized company_id, backfill, enforce, tighten RLS
ALTER TABLE public.billing_overrides ADD COLUMN IF NOT EXISTS company_id uuid;

UPDATE public.billing_overrides bo
   SET company_id = tr.company_id
  FROM public.trip_records tr
 WHERE bo.trip_id = tr.id AND bo.company_id IS NULL;

ALTER TABLE public.billing_overrides ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.billing_overrides
  ADD CONSTRAINT billing_overrides_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_billing_overrides_company_id ON public.billing_overrides(company_id);

-- Trigger: auto-set + lock company_id from trip_records to prevent cross-tenant inserts
CREATE OR REPLACE FUNCTION public.set_billing_override_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_company uuid;
BEGIN
  SELECT company_id INTO v_trip_company FROM public.trip_records WHERE id = NEW.trip_id;
  IF v_trip_company IS NULL THEN
    RAISE EXCEPTION 'billing_overrides.trip_id % does not reference an existing trip', NEW.trip_id;
  END IF;
  NEW.company_id := v_trip_company;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_billing_override_company_id ON public.billing_overrides;
CREATE TRIGGER trg_set_billing_override_company_id
  BEFORE INSERT OR UPDATE OF trip_id, company_id ON public.billing_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_billing_override_company_id();

-- Replace policies with direct company_id filters
DROP POLICY IF EXISTS "Billing/admin read billing overrides" ON public.billing_overrides;
DROP POLICY IF EXISTS "Billing/admin can insert billing overrides" ON public.billing_overrides;

CREATE POLICY "Billing/admin read billing overrides"
  ON public.billing_overrides FOR SELECT TO authenticated
  USING (
    (is_billing() OR is_admin())
    AND company_id = get_my_company_id()
  );

CREATE POLICY "Billing/admin can insert billing overrides"
  ON public.billing_overrides FOR INSERT TO authenticated
  WITH CHECK (
    (is_billing() OR is_admin() OR is_system_creator())
    AND company_id = get_my_company_id()
  );

-- 2) company_invites: restrict policy to authenticated role
DROP POLICY IF EXISTS "Owners manage company invites" ON public.company_invites;

CREATE POLICY "Owners manage company invites"
  ON public.company_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = company_invites.profile_id
        AND public.is_company_owner_or_creator(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = company_invites.profile_id
        AND public.is_company_owner_or_creator(p.company_id)
    )
  );