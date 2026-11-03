ALTER TABLE public.nemsis_cert_records
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_by uuid,
  ADD COLUMN IF NOT EXISTS last_validation jsonb;

CREATE OR REPLACE FUNCTION public.guard_nemsis_cert_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = NEW.company_id
      AND c.nemsis_certification AND (COALESCE(c.is_sandbox,false) OR COALESCE(c.creator_test_tenant,false))) THEN
    RAISE EXCEPTION 'NEMSIS certification records are allowed only on the certification company';
  END IF;
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.payload IS DISTINCT FROM OLD.payload THEN
    -- Any edit reopens the record: it must be validated and finalized again.
    NEW.finalized_at := NULL;
    NEW.finalized_by := NULL;
    IF NEW.kind = 'DEM' AND (NEW.payload - 'meta') IS DISTINCT FROM (OLD.payload - 'meta') THEN
      NEW.pending_auto_submit := true;
    END IF;
  END IF;
  RETURN NEW;
END $$;