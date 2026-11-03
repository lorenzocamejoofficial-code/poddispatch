ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS nemsis_certification boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.companies.nemsis_certification IS 'Only a test/sandbox company with this flag may have records submitted to the NEMSIS CTA.';

CREATE OR REPLACE FUNCTION public.guard_nemsis_certification_flag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nemsis_certification THEN
    IF NOT (COALESCE(NEW.is_sandbox,false) OR COALESCE(NEW.creator_test_tenant,false)) THEN
      RAISE EXCEPTION 'NEMSIS certification flag requires a test/sandbox company';
    END IF;
    IF TG_OP = 'INSERT' OR NOT COALESCE(OLD.nemsis_certification,false) THEN
      IF auth.uid() IS NOT NULL AND NOT public.is_system_creator() THEN
        RAISE EXCEPTION 'Only system creators can set the NEMSIS certification flag';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_nemsis_certification_flag ON public.companies;
CREATE TRIGGER trg_guard_nemsis_certification_flag
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_nemsis_certification_flag();

CREATE TABLE public.nemsis_cert_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('DEM','EMS')),
  case_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  pending_auto_submit boolean NOT NULL DEFAULT false,
  last_auto_submit_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, case_key)
);
COMMENT ON TABLE public.nemsis_cert_records IS 'Synthetic NEMSIS certification records (DEM profile / EMS PCR input) for the certification company only.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nemsis_cert_records TO authenticated;
GRANT ALL ON public.nemsis_cert_records TO service_role;
ALTER TABLE public.nemsis_cert_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators manage certification records" ON public.nemsis_cert_records
  FOR ALL TO authenticated USING (public.is_system_creator()) WITH CHECK (public.is_system_creator());

CREATE OR REPLACE FUNCTION public.guard_nemsis_cert_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id
      AND c.nemsis_certification AND (COALESCE(c.is_sandbox,false) OR COALESCE(c.creator_test_tenant,false))) THEN
    RAISE EXCEPTION 'NEMSIS certification records are allowed only on the certification company';
  END IF;
  NEW.updated_at := now();
  -- Required automatic case: a DEM change (anything except the app-only "meta" key)
  -- marks the record for an automatic DEMDataSet resend.
  IF TG_OP = 'UPDATE' AND NEW.kind = 'DEM'
     AND (NEW.payload - 'meta') IS DISTINCT FROM (OLD.payload - 'meta') THEN
    NEW.pending_auto_submit := true;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_nemsis_cert_record
BEFORE INSERT OR UPDATE ON public.nemsis_cert_records
FOR EACH ROW EXECUTE FUNCTION public.guard_nemsis_cert_record();

-- Wake the submit function; it acts only on pending DEM rows of the certification company.
CREATE OR REPLACE FUNCTION public.wake_nemsis_dem_auto_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pending_auto_submit AND NOT COALESCE(OLD.pending_auto_submit,false) THEN
    PERFORM net.http_post(
      url := 'https://slyxmgoonugqsnubdrqi.supabase.co/functions/v1/nemsis-cta-submit',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('action','auto_dem','record_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.wake_nemsis_dem_auto_submit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_wake_nemsis_dem_auto_submit
AFTER UPDATE ON public.nemsis_cert_records
FOR EACH ROW EXECUTE FUNCTION public.wake_nemsis_dem_auto_submit();

ALTER TABLE public.nemsis_cta_submissions
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS cert_record_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'fixture',
  ADD COLUMN IF NOT EXISTS trigger_kind text NOT NULL DEFAULT 'manual';
COMMENT ON COLUMN public.nemsis_cta_submissions.source IS 'fixture (regression baseline) | generated (built from nemsis_cert_records)';