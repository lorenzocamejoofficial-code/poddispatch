
-- 1. Create clearinghouse_settings table
CREATE TABLE public.clearinghouse_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  clearinghouse_name text NOT NULL DEFAULT 'office_ally',
  sftp_host text NOT NULL DEFAULT 'sftp.officeally.com',
  sftp_port integer NOT NULL DEFAULT 22,
  sftp_username text,
  sftp_password_encrypted text,
  outbound_folder text NOT NULL DEFAULT '/upload',
  inbound_folder text NOT NULL DEFAULT '/download',
  is_configured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  auto_send_enabled boolean NOT NULL DEFAULT false,
  auto_receive_enabled boolean NOT NULL DEFAULT false,
  last_send_at timestamptz,
  last_receive_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.clearinghouse_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS: owners can read their company's settings
CREATE POLICY "Owners can view clearinghouse settings"
  ON public.clearinghouse_settings FOR SELECT
  TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_admin());

-- 4. RLS: owners can insert their company's settings
CREATE POLICY "Owners can insert clearinghouse settings"
  ON public.clearinghouse_settings FOR INSERT
  TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin());

-- 5. RLS: owners can update their company's settings
CREATE POLICY "Owners can update clearinghouse settings"
  ON public.clearinghouse_settings FOR UPDATE
  TO authenticated
  USING (company_id = public.get_my_company_id() AND public.is_admin())
  WITH CHECK (company_id = public.get_my_company_id() AND public.is_admin());

-- 6. Add sftp_sent_at to claim_records
ALTER TABLE public.claim_records ADD COLUMN IF NOT EXISTS sftp_sent_at timestamptz;

-- 7. Add updated_at trigger
CREATE TRIGGER update_clearinghouse_settings_updated_at
  BEFORE UPDATE ON public.clearinghouse_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Seed a default row for every existing company
INSERT INTO public.clearinghouse_settings (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

-- 9. Add step_clearinghouse_connected to migration_settings
ALTER TABLE public.migration_settings ADD COLUMN IF NOT EXISTS step_clearinghouse_connected boolean NOT NULL DEFAULT false;
