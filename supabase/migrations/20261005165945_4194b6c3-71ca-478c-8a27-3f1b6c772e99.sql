-- Mirrors src/lib/transport-vocabulary.ts normalizeTransportKind (null for unknown, never dialysis)
CREATE OR REPLACE FUNCTION public.normalize_transport_kind(_v text)
RETURNS public.transport_kind LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (CASE lower(btrim(coalesce(_v,'')))
    WHEN 'dialysis' THEN 'dialysis' WHEN 'nemt_dialysis' THEN 'dialysis'
    WHEN 'ift' THEN 'ift' WHEN 'ift_general' THEN 'ift'
    WHEN 'discharge' THEN 'discharge' WHEN 'ift_discharge' THEN 'discharge'
    WHEN 'outpatient' THEN 'outpatient' WHEN 'outpatient_specialty' THEN 'outpatient'
    WHEN 'wound_care' THEN 'wound_care' WHEN 'woundcare' THEN 'wound_care' WHEN 'ift_wound_care' THEN 'wound_care'
    WHEN 'psych' THEN 'psych' WHEN 'psych_transport' THEN 'psych' WHEN 'behavioral' THEN 'psych'
    ELSE NULL END)::public.transport_kind
$$;

-- Mirrors src/lib/payer-class.ts normalizePayerClass (null for unknown; facility only when explicitly designated)
CREATE OR REPLACE FUNCTION public.normalize_payer_class(_v text)
RETURNS public.payer_class LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (CASE
    WHEN r = '' THEN NULL
    WHEN r IN ('medicare') THEN 'medicare'
    WHEN r IN ('medicaid') THEN 'medicaid'
    WHEN r IN ('commercial','private','insurance','private_insurance') THEN 'commercial'
    WHEN r IN ('facility','facility_contract','contract') THEN 'facility'
    WHEN r IN ('self_pay','self-pay','selfpay','self','cash','private_pay','private pay','patient') THEN 'self_pay'
    WHEN r LIKE '%medicaid%' THEN 'medicaid'
    WHEN r LIKE '%medicare%' THEN 'medicare'
    ELSE NULL END)::public.payer_class
  FROM (SELECT lower(btrim(coalesce(_v,''))) AS r) s
$$;

CREATE OR REPLACE FUNCTION public.dualwrite_patient_classification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.transport_type IS DISTINCT FROM OLD.transport_type OR NEW.transport_kind IS NULL THEN
    NEW.transport_kind := public.normalize_transport_kind(NEW.transport_type::text);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.primary_payer IS DISTINCT FROM OLD.primary_payer OR NEW.payer_class IS NULL THEN
    NEW.payer_class := public.normalize_payer_class(NEW.primary_payer);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.dualwrite_leg_classification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pt_payer text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.trip_type IS DISTINCT FROM OLD.trip_type OR NEW.transport_kind IS NULL THEN
    NEW.transport_kind := public.normalize_transport_kind(NEW.trip_type::text);
  END IF;
  IF TG_OP = 'INSERT' OR NEW.oneoff_primary_payer IS DISTINCT FROM OLD.oneoff_primary_payer
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id OR NEW.payer_class IS NULL THEN
    SELECT primary_payer INTO pt_payer FROM public.patients WHERE id = NEW.patient_id;
    NEW.payer_class := coalesce(public.normalize_payer_class(NEW.oneoff_primary_payer),
                                public.normalize_payer_class(pt_payer));
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.dualwrite_trip_classification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pt_type text; pt_payer text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.trip_type IS DISTINCT FROM OLD.trip_type OR NEW.pcr_type IS DISTINCT FROM OLD.pcr_type
     OR NEW.primary_payer IS DISTINCT FROM OLD.primary_payer OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.transport_kind IS NULL OR NEW.payer_class IS NULL THEN
    SELECT transport_type::text, primary_payer INTO pt_type, pt_payer FROM public.patients WHERE id = NEW.patient_id;
    -- precedence trip_type > pcr_type > patient (resolveTransportKind)
    NEW.transport_kind := coalesce(public.normalize_transport_kind(NEW.trip_type::text),
                                   public.normalize_transport_kind(NEW.pcr_type),
                                   public.normalize_transport_kind(pt_type));
    NEW.payer_class := coalesce(public.normalize_payer_class(NEW.primary_payer),
                                public.normalize_payer_class(pt_payer));
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.dualwrite_leg_classification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dualwrite_trip_classification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_dualwrite_patient_classification BEFORE INSERT OR UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.dualwrite_patient_classification();
CREATE TRIGGER trg_dualwrite_leg_classification BEFORE INSERT OR UPDATE ON public.scheduling_legs
  FOR EACH ROW EXECUTE FUNCTION public.dualwrite_leg_classification();
CREATE TRIGGER trg_dualwrite_trip_classification BEFORE INSERT OR UPDATE ON public.trip_records
  FOR EACH ROW EXECUTE FUNCTION public.dualwrite_trip_classification();