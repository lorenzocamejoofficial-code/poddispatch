
-- Trucks: service level (BLS / ALS)
DO $$ BEGIN
  CREATE TYPE public.truck_service_level AS ENUM ('BLS', 'ALS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS service_level public.truck_service_level NOT NULL DEFAULT 'BLS';

-- Cert type & status enums
DO $$ BEGIN
  CREATE TYPE public.crew_cert_type AS ENUM ('medic_number', 'cpr', 'drivers_license');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crew_cert_status AS ENUM ('pending_review', 'approved', 'rejected', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crew_cert_level AS ENUM ('EMR', 'EMT_B', 'EMT_A', 'PARAMEDIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Certifications table
CREATE TABLE IF NOT EXISTS public.crew_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  cert_type public.crew_cert_type NOT NULL,
  cert_level public.crew_cert_level NULL, -- only used for medic_number
  cert_number text NULL,
  photo_path text NULL, -- storage path in crew-certifications bucket
  issue_date date NULL,
  expiration_date date NULL,
  status public.crew_cert_status NOT NULL DEFAULT 'pending_review',
  rejection_reason text NULL,
  manually_verified boolean NOT NULL DEFAULT false,
  manual_verification_reason text NULL,
  manual_verification_expires_at date NULL,
  uploaded_by uuid NULL,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crew_certs_user ON public.crew_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_certs_company ON public.crew_certifications(company_id);
CREATE INDEX IF NOT EXISTS idx_crew_certs_status ON public.crew_certifications(status);
CREATE INDEX IF NOT EXISTS idx_crew_certs_expiration ON public.crew_certifications(expiration_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_certifications TO authenticated;
GRANT ALL ON public.crew_certifications TO service_role;

ALTER TABLE public.crew_certifications ENABLE ROW LEVEL SECURITY;

-- Crew can see/manage their own
CREATE POLICY "Users view own certs"
  ON public.crew_certifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_system_creator());

CREATE POLICY "Users insert own certs"
  ON public.crew_certifications FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY "Users update own pending certs; admins update any"
  ON public.crew_certifications FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending_review')
    OR public.is_admin()
    OR public.is_system_creator()
  )
  WITH CHECK (
    (user_id = auth.uid() AND company_id = public.get_my_company_id())
    OR public.is_admin()
    OR public.is_system_creator()
  );

CREATE POLICY "Admins delete certs"
  ON public.crew_certifications FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_system_creator());

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_crew_certs_updated_at ON public.crew_certifications;
CREATE TRIGGER trg_crew_certs_updated_at
  BEFORE UPDATE ON public.crew_certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: is crew member assignable? (all 3 cert types approved & not expired)
CREATE OR REPLACE FUNCTION public.crew_assignable(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(DISTINCT cert_type)
    FROM public.crew_certifications
    WHERE user_id = _user_id
      AND status = 'approved'
      AND (
        (expiration_date IS NOT NULL AND expiration_date >= CURRENT_DATE)
        OR (manually_verified = true
            AND (manual_verification_expires_at IS NULL OR manual_verification_expires_at >= CURRENT_DATE))
      )
  ) = 3;
$$;
