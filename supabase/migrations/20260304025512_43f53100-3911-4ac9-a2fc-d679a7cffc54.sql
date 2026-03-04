
-- Add company_id to company_settings for multi-tenant isolation
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Backfill existing company_settings rows using the company name match
UPDATE public.company_settings cs
SET company_id = c.id
FROM public.companies c
WHERE cs.company_name = c.name AND cs.company_id IS NULL;

-- Update RLS policies on company_settings
DROP POLICY IF EXISTS "All read company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins update settings" ON public.company_settings;

CREATE POLICY "Members read own company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins manage company settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "System creator read all company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (is_system_creator());

-- Add read policies for facilities table (dispatchers and billers need to read facilities)
CREATE POLICY "Dispatchers read facilities"
  ON public.facilities FOR SELECT
  TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Billing read facilities"
  ON public.facilities FOR SELECT
  TO authenticated
  USING (is_billing() AND company_id = get_my_company_id());

CREATE POLICY "System creator read facilities"
  ON public.facilities FOR SELECT
  TO authenticated
  USING (is_system_creator());
