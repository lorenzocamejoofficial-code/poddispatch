CREATE OR REPLACE FUNCTION public.normalize_payer_class(_v text)
 RETURNS payer_class LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT (CASE
    WHEN r = '' THEN NULL
    WHEN r IN ('medicare') THEN 'medicare'
    WHEN r IN ('medicaid') THEN 'medicaid'
    WHEN r IN ('self_pay','selfpay','self','cash','cash_payment','private_pay','patient') THEN 'self_pay'
    WHEN r IN ('commercial','private','insurance','private_insurance') THEN 'commercial'
    WHEN r IN ('facility','facility_contract','contract') THEN 'facility'
    WHEN r LIKE '%medicaid%' THEN 'medicaid'
    WHEN r LIKE '%medicare%' THEN 'medicare'
    WHEN r LIKE '%self%' OR r LIKE '%cash%' THEN 'self_pay'
    ELSE NULL END)::public.payer_class
  FROM (SELECT regexp_replace(lower(btrim(coalesce(_v,''))), '[\s\-]+', '_', 'g') AS r) s
$function$;

ALTER TABLE public.claim_records ADD COLUMN IF NOT EXISTS payer_class public.payer_class;
ALTER TABLE public.claim_records ADD COLUMN IF NOT EXISTS rate_flag text;

CREATE OR REPLACE FUNCTION public.dualwrite_claim_payer_class()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_derived public.payer_class;
BEGIN
  v_derived := coalesce(public.normalize_payer_class(NEW.payer_type), public.normalize_payer_class(NEW.payer_name));
  IF TG_OP = 'INSERT' THEN
    NEW.payer_class := coalesce(NEW.payer_class, v_derived);
  ELSIF NEW.payer_type IS DISTINCT FROM OLD.payer_type OR NEW.payer_name IS DISTINCT FROM OLD.payer_name THEN
    IF NEW.payer_class IS NOT DISTINCT FROM OLD.payer_class THEN NEW.payer_class := coalesce(v_derived, NEW.payer_class); END IF;
  ELSIF NEW.payer_class IS NULL THEN
    NEW.payer_class := v_derived;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_dualwrite_claim_payer_class ON public.claim_records;
CREATE TRIGGER trg_dualwrite_claim_payer_class BEFORE INSERT OR UPDATE ON public.claim_records
  FOR EACH ROW EXECUTE FUNCTION public.dualwrite_claim_payer_class();

CREATE OR REPLACE FUNCTION public.auto_create_claim_on_pcr_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payer_type text;
  v_payer_class public.payer_class;
  v_leg_payer text;
  v_patient_payer text;
  v_rate_flag text;
  v_rate_found boolean := false;
  v_member_id  text;
  v_leg        record;
  v_origin_addr text;
  v_dest_addr text;
  v_origin_zip text;
  v_dest_zip text;
  v_pcs_on_file boolean;
  v_patient_bariatric boolean := false;
  v_rate record;
  v_base_charge numeric := 0;
  v_mileage_charge numeric := 0;
  v_extras_charge numeric := 0;
  v_total_charge numeric := 0;
  v_hcpcs text;
  v_origin_mod text;
  v_dest_mod text;
  v_modifiers text[];
  v_origin_fac_type text;
  v_origin_fac_subtype text;
  v_dest_fac_type text;
  v_dest_fac_subtype text;
  v_sqlstate text;
  v_errmsg text;
BEGIN
  IF NEW.pcr_status IS DISTINCT FROM 'submitted' THEN RETURN NEW; END IF;
  IF OLD.pcr_status IS NOT DISTINCT FROM NEW.pcr_status THEN RETURN NEW; END IF;

  BEGIN
    IF NEW.patient_id IS NOT NULL THEN
      SELECT p.primary_payer, lower(trim(COALESCE(p.primary_payer, 'default'))), p.member_id,
             COALESCE(p.pcs_on_file, false), COALESCE(p.bariatric, false)
        INTO v_patient_payer, v_payer_type, v_member_id, v_pcs_on_file, v_patient_bariatric
        FROM public.patients p WHERE p.id = NEW.patient_id;
    END IF;

    IF (v_payer_type IS NULL OR v_member_id IS NULL) AND NEW.leg_id IS NOT NULL THEN
      SELECT oneoff_primary_payer, oneoff_member_id, oneoff_pickup_address
        INTO v_leg FROM public.scheduling_legs WHERE id = NEW.leg_id;
      v_leg_payer := v_leg.oneoff_primary_payer;
      IF v_payer_type IS NULL THEN v_payer_type := lower(trim(COALESCE(v_leg.oneoff_primary_payer, 'default'))); END IF;
      IF v_member_id IS NULL THEN v_member_id := v_leg.oneoff_member_id; END IF;
    END IF;

    IF NEW.member_id IS NOT NULL AND length(trim(NEW.member_id)) > 0 THEN v_member_id := NEW.member_id; END IF;
    IF NEW.primary_payer IS NOT NULL AND length(trim(NEW.primary_payer)) > 0 THEN v_payer_type := lower(trim(NEW.primary_payer)); END IF;

    v_payer_type := lower(trim(COALESCE(v_payer_type, 'default')));
    IF v_payer_type = '' THEN v_payer_type := 'default'; END IF;

    v_origin_addr := NEW.pickup_location;
    v_dest_addr   := NEW.destination_location;
    v_origin_zip := substring(coalesce(v_origin_addr, '') from '\d{5}');
    v_dest_zip   := substring(coalesce(v_dest_addr, '') from '\d{5}');

    IF NEW.pickup_location IS NOT NULL AND btrim(NEW.pickup_location) <> '' THEN
      SELECT f.facility_type, f.dialysis_subtype
        INTO v_origin_fac_type, v_origin_fac_subtype
        FROM public.facilities f
       WHERE f.company_id = NEW.company_id
         AND lower(btrim(f.name)) = lower(btrim(NEW.pickup_location))
       LIMIT 1;
    END IF;
    IF NEW.destination_location IS NOT NULL AND btrim(NEW.destination_location) <> '' THEN
      SELECT f.facility_type, f.dialysis_subtype
        INTO v_dest_fac_type, v_dest_fac_subtype
        FROM public.facilities f
       WHERE f.company_id = NEW.company_id
         AND lower(btrim(f.name)) = lower(btrim(NEW.destination_location))
       LIMIT 1;
    END IF;

    v_hcpcs := public.derive_ambulance_hcpcs(NEW.service_level, COALESCE(NEW.is_emergency_pcr, false));
    v_origin_mod := public.derive_ambulance_modifier_letter(NEW.origin_type, v_origin_fac_type, v_origin_fac_subtype);
    v_dest_mod   := public.derive_ambulance_modifier_letter(NEW.destination_type, v_dest_fac_type, v_dest_fac_subtype);
    v_modifiers := ARRAY[v_origin_mod || v_dest_mod];

    -- Stage 5: payer_class decides pricing (trip > patient > one-off leg).
    v_payer_class := coalesce(NEW.payer_class,
                              public.normalize_payer_class(NEW.primary_payer),
                              public.normalize_payer_class(v_patient_payer),
                              public.normalize_payer_class(v_leg_payer));

    IF v_payer_class IS NULL THEN
      SELECT * INTO v_rate FROM public.charge_master cm
       WHERE cm.company_id = NEW.company_id AND lower(btrim(cm.payer_type)) = 'default'
       ORDER BY cm.updated_at DESC NULLS LAST LIMIT 1;
      v_rate_found := FOUND;
      v_rate_flag := 'no_payer: no payer recorded on trip or patient - priced at default rate, needs review';
      IF NOT v_rate_found THEN v_rate_flag := 'no_payer: no payer recorded and no default rate row - charges are $0'; END IF;
    ELSE
      SELECT * INTO v_rate FROM public.charge_master cm
       WHERE cm.company_id = NEW.company_id
         AND public.normalize_payer_class(cm.payer_type) = v_payer_class
       ORDER BY cm.updated_at DESC NULLS LAST LIMIT 1;
      v_rate_found := FOUND;
      IF NOT v_rate_found THEN
        -- Never silently fall back to the default rate.
        v_rate_flag := 'missing_rate: no ' || v_payer_class::text || ' rate in charge master - charges are $0 until a rate is added';
      END IF;
    END IF;

    IF v_rate_found THEN
      v_base_charge := COALESCE(v_rate.base_rate, 0);
      v_mileage_charge := COALESCE(v_rate.mileage_rate, 0) * COALESCE(NEW.loaded_miles, 0);
      v_total_charge := v_base_charge + v_mileage_charge + v_extras_charge;
    END IF;

    -- Every new claim starts in needs_review; only the TypeScript readiness
    -- gate may promote it to ready_to_bill once it is provably clean.
    INSERT INTO public.claim_records (
      trip_id, patient_id, run_date, company_id, origin_type, destination_type,
      origin_address, origin_zip, destination_address, destination_zip,
      pcs_document_on_file, payer_type, member_id, icd10_codes,
      has_emergency_event, chief_complaint, primary_impression, medical_necessity_reason,
      service_level, status, base_charge, mileage_charge, extras_charge, total_charge,
      hcpcs_codes, hcpcs_modifiers, is_simulated, simulation_run_id,
      payer_class, rate_flag
    ) VALUES (
      NEW.id, NEW.patient_id, NEW.run_date, NEW.company_id, NEW.origin_type, NEW.destination_type,
      v_origin_addr, v_origin_zip, v_dest_addr, v_dest_zip,
      COALESCE(v_pcs_on_file, false), v_payer_type, v_member_id, NEW.icd10_codes,
      COALESCE(NEW.is_emergency_pcr, false),
      NEW.chief_complaint, NEW.primary_impression, NEW.medical_necessity_reason,
      NEW.service_level, 'needs_review'::claim_status,
      v_base_charge, v_mileage_charge, v_extras_charge, v_total_charge,
      ARRAY[v_hcpcs], v_modifiers,
      COALESCE(NEW.is_simulated, false), NEW.simulation_run_id,
      v_payer_class, v_rate_flag
    )
    ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL AND original_claim_id IS NULL
    DO UPDATE SET
      icd10_codes = EXCLUDED.icd10_codes, member_id = EXCLUDED.member_id,
      payer_type = EXCLUDED.payer_type, payer_class = EXCLUDED.payer_class, rate_flag = EXCLUDED.rate_flag,
      origin_type = EXCLUDED.origin_type,
      destination_type = EXCLUDED.destination_type, origin_address = EXCLUDED.origin_address,
      origin_zip = EXCLUDED.origin_zip, destination_address = EXCLUDED.destination_address,
      destination_zip = EXCLUDED.destination_zip, pcs_document_on_file = EXCLUDED.pcs_document_on_file,
      has_emergency_event = EXCLUDED.has_emergency_event, chief_complaint = EXCLUDED.chief_complaint,
      primary_impression = EXCLUDED.primary_impression, medical_necessity_reason = EXCLUDED.medical_necessity_reason,
      service_level = EXCLUDED.service_level, base_charge = EXCLUDED.base_charge,
      mileage_charge = EXCLUDED.mileage_charge, extras_charge = EXCLUDED.extras_charge,
      total_charge = EXCLUDED.total_charge,
      hcpcs_codes = CASE WHEN COALESCE(public.claim_records.hcpcs_manually_set, false)
                         THEN public.claim_records.hcpcs_codes ELSE EXCLUDED.hcpcs_codes END,
      hcpcs_modifiers = CASE WHEN COALESCE(public.claim_records.hcpcs_manually_set, false)
                             THEN public.claim_records.hcpcs_modifiers ELSE EXCLUDED.hcpcs_modifiers END,
      is_simulated = EXCLUDED.is_simulated,
      simulation_run_id = COALESCE(EXCLUDED.simulation_run_id, public.claim_records.simulation_run_id),
      updated_at = now();

    UPDATE public.trip_records
       SET claim_creation_status = 'created',
           status = CASE WHEN status = 'completed'::public.trip_status
                         THEN 'ready_for_billing'::public.trip_status
                         ELSE status END
     WHERE id = NEW.id;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE, v_errmsg = MESSAGE_TEXT;
    RAISE WARNING 'auto_create_claim_on_pcr_submit failed for trip %: %', NEW.id, v_errmsg;
    BEGIN
      UPDATE public.trip_records SET claim_creation_status = 'failed' WHERE id = NEW.id;
      INSERT INTO public.claim_creation_failures (trip_id, company_id, error_message, sqlstate)
      VALUES (NEW.id, NEW.company_id, v_errmsg, v_sqlstate);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'claim_creation_failures insert also failed for trip %: %', NEW.id, SQLERRM;
    END;
  END;

  RETURN NEW;
END;
$function$;