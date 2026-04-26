
-- 1. Companies: EIN + structured address (all nullable for backfill safety)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ein_number text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_zip text;

-- 2. Migration settings: add step_company_info_verified flag
ALTER TABLE public.migration_settings
  ADD COLUMN IF NOT EXISTS step_company_info_verified boolean NOT NULL DEFAULT false;

-- 3. Server-only clearinghouse credentials store
CREATE TABLE IF NOT EXISTS public.clearinghouse_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  sftp_password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clearinghouse_credentials ENABLE ROW LEVEL SECURITY;

-- No policies = no client access. Only the service role (used by edge functions)
-- can read/write this table. This is intentional: SFTP passwords must never be
-- exposed to the browser.

CREATE TRIGGER update_clearinghouse_credentials_updated_at
BEFORE UPDATE ON public.clearinghouse_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
