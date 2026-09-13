ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS archived_role text;

CREATE INDEX IF NOT EXISTS idx_profiles_company_active ON public.profiles (company_id, active);