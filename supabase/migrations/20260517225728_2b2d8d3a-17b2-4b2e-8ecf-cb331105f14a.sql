-- Helper: derive HCPCS base code from service level + emergency flag
CREATE OR REPLACE FUNCTION public.derive_ambulance_hcpcs(_service_level text, _is_emergency boolean)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN COALESCE(_is_emergency, false) THEN
      CASE upper(COALESCE(_service_level, 'BLS'))
        WHEN 'ALS2' THEN 'A0433'
        WHEN 'ALS1' THEN 'A0427'
        WHEN 'SCT'  THEN 'A0434'
        ELSE 'A0429' -- BLS Emergency
      END
    ELSE
      CASE upper(COALESCE(_service_level, 'BLS'))
        WHEN 'ALS2' THEN 'A0433'
        WHEN 'ALS1' THEN 'A0426'
        WHEN 'SCT'  THEN 'A0434'
        ELSE 'A0428' -- BLS Non-Emergency
      END
  END;
$$;

-- Helper: map an origin/destination type to the single CMS modifier letter
CREATE OR REPLACE FUNCTION public.derive_ambulance_modifier_letter(_loc_type text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(COALESCE(_loc_type, ''))
    WHEN 'residence'           THEN 'R'
    WHEN 'home'                THEN 'R'
    WHEN 'hospital'            THEN 'H'
    WHEN 'emergency_room'      THEN 'H'
    WHEN 'er'                  THEN 'H'
    WHEN 'snf'                 THEN 'N'
    WHEN 'nursing_home'        THEN 'N'
    WHEN 'nursing_facility'    THEN 'N'
    WHEN 'skilled_nursing'     THEN 'N'
    WHEN 'dialysis'            THEN 'G'
    WHEN 'dialysis_center'     THEN 'G'
    WHEN 'freestanding_dialysis' THEN 'J'
    WHEN 'physician_office'    THEN 'P'
    WHEN 'doctor_office'       THEN 'P'
    WHEN 'scene'               THEN 'S'
    WHEN 'scene_of_accident'   THEN 'S'
    WHEN 'assisted_living'     THEN 'E'
    WHEN 'rehab'               THEN 'E'
    WHEN 'rehabilitation'      THEN 'E'
    WHEN 'custodial'           THEN 'E'
    WHEN 'diagnostic'          THEN 'D'
    WHEN 'outpatient'          THEN 'D'
    WHEN 'intermediate'        THEN 'I'
    ELSE 'E' -- safe default: other non-listed facility
  END;
$$;

-- Replace the auto-create trigger so it stamps HCPCS code + origin/destination modifier
CREATE OR REPLACE FUNCTION public.auto_create_claim_on_pcr_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payer_type text;
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
  v_sqlstate text;
  v_errmsg text;
BEGIN
  IF NEW.pcr_status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF OLD.pcr_status IS NOT DISTINCT FROM NEW.pcr_status THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NEW.patient_id IS NOT NULL THEN
      SELECT lower(trim(COALESCE(p.primary_payer, 'default'))),
             p.member_id,
             COALESCE(p.pcs_on_file, false),
             COALESCE(p.bariatric, false)
        INTO v_payer_type, v_member_id, v_pcs_on_file, v_patient_bariatric
        FROM public.patients p
       WHERE p.id = NEW.patient_id;
    END IF;

    IF (v_payer_type IS NULL OR v_member_id IS NULL) AND NEW.leg_id IS NOT NULL THEN
      SELECT oneoff_primary_payer, oneoff_member_id, oneoff_pickup_address
        INTO v_leg
        FROM public.scheduling_legs
       WHERE id = NEW.leg_id;
      IF v_payer_type IS NULL THEN
        v_payer_type := lower(trim(COALESCE(v_leg.oneoff_primary_payer, 'default')));
      END IF;
      IF v_member_id IS NULL THEN
        v_member_id := v_leg.oneoff_member_id;
      END IF;
    END IF;

    IF NEW.member_id IS NOT NULL AND length(trim(NEW.member_id)) > 0 THEN
      v_member_id := NEW.member_id;
    END IF;
    IF NEW.primary_payer IS NOT NULL AND length(trim(NEW.primary_payer)) > 0 THEN
      v_payer_type := lower(trim(NEW.primary_payer));
    END IF;

    v_payer_type := lower(trim(COALESCE(v_payer_type, 'default')));
    IF v_payer_type = '' THEN v_payer_type := 'default'; END IF;

    v_origin_addr := NEW.pickup_location;
    v_dest_addr   := NEW.destination_location;
    v_origin_zip := substring(coalesce(v_origin_addr, '') from '\d{5}');
    v_dest_zip   := substring(coalesce(v_dest_addr, '') from '\d{5}');

    -- HCPCS + modifier derivation
    v_hcpcs := public.derive_ambulance_hcpcs(NEW.service_level, COALESCE(NEW.is_emergency_pcr, false));
    v_origin_mod := public.derive_ambulance_modifier_letter(NEW.origin_type);
    v_dest_mod   := public.derive_ambulance_modifier_letter(NEW.destination_type);
    v_modifiers := ARRAY[v_origin_mod || v_dest_mod];

    SELECT * INTO v_rate
      FROM public.charge_master cm
     WHERE cm.company_id = NEW.company_id
       AND lower(cm.payer_type) = v_payer_type
     ORDER BY cm.updated_at DESC NULLS LAST
     LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_rate
        FROM public.charge_master cm
       WHERE cm.company_id = NEW.company_id
         AND lower(cm.payer_type) = 'default'
       ORDER BY cm.updated_at DESC NULLS LAST
       LIMIT 1;
    END IF;

    IF FOUND THEN
      v_base_charge := COALESCE(v_rate.base_rate, 0);
      v_mileage_charge := COALESCE(NEW.loaded_miles, 0) * COALESCE(v_rate.mileage_rate, 0);
      v_extras_charge := COALESCE(NEW.wait_time_minutes, 0) * COALESCE(v_rate.wait_rate_per_min, 0)
        + CASE WHEN COALESCE(NEW.oxygen_during_transport, false) THEN COALESCE(v_rate.oxygen_fee, 0) ELSE 0 END
        + CASE WHEN COALESCE(v_patient_bariatric, false) THEN COALESCE(v_rate.bariatric_fee, 0) ELSE 0 END;
      v_total_charge := v_base_charge + v_mileage_charge + v_extras_charge;
    END IF;

    INSERT INTO public.claim_records (
      trip_id, patient_id, run_date, company_id, origin_type, destination_type,
      origin_address, origin_zip, destination_address, destination_zip,
      pcs_document_on_file, payer_type, member_id, icd10_codes, has_emergency_event,
      chief_complaint, primary_impression, medical_necessity_reason, service_level, status,
      base_charge, mileage_charge, extras_charge, total_charge,
      hcpcs_codes, hcpcs_modifiers,
      is_simulated, simulation_run_id
    )
    VALUES (
      NEW.id, NEW.patient_id, NEW.run_date, NEW.company_id, NEW.origin_type, NEW.destination_type,
      v_origin_addr, v_origin_zip, v_dest_addr, v_dest_zip,
      COALESCE(v_pcs_on_file, false), v_payer_type, v_member_id, NEW.icd10_codes,
      COALESCE(NEW.is_emergency_pcr, false),
      NEW.chief_complaint, NEW.primary_impression, NEW.medical_necessity_reason,
      NEW.service_level, 'ready_to_bill'::claim_status,
      v_base_charge, v_mileage_charge, v_extras_charge, v_total_charge,
      ARRAY[v_hcpcs], v_modifiers,
      COALESCE(NEW.is_simulated, false), NEW.simulation_run_id
    )
    ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL
    DO UPDATE SET
      icd10_codes              = EXCLUDED.icd10_codes,
      member_id                = EXCLUDED.member_id,
      payer_type               = EXCLUDED.payer_type,
      origin_type              = EXCLUDED.origin_type,
      destination_type         = EXCLUDED.destination_type,
      origin_address           = EXCLUDED.origin_address,
      origin_zip               = EXCLUDED.origin_zip,
      destination_address      = EXCLUDED.destination_address,
      destination_zip          = EXCLUDED.destination_zip,
      pcs_document_on_file     = EXCLUDED.pcs_document_on_file,
      has_emergency_event      = EXCLUDED.has_emergency_event,
      chief_complaint          = EXCLUDED.chief_complaint,
      primary_impression       = EXCLUDED.primary_impression,
      medical_necessity_reason = EXCLUDED.medical_necessity_reason,
      service_level            = EXCLUDED.service_level,
      base_charge              = EXCLUDED.base_charge,
      mileage_charge           = EXCLUDED.mileage_charge,
      extras_charge            = EXCLUDED.extras_charge,
      total_charge             = EXCLUDED.total_charge,
      hcpcs_codes              = CASE WHEN COALESCE(public.claim_records.hcpcs_manually_set, false)
                                      THEN public.claim_records.hcpcs_codes
                                      ELSE EXCLUDED.hcpcs_codes END,
      hcpcs_modifiers          = CASE WHEN COALESCE(public.claim_records.hcpcs_manually_set, false)
                                      THEN public.claim_records.hcpcs_modifiers
                                      ELSE EXCLUDED.hcpcs_modifiers END,
      is_simulated             = EXCLUDED.is_simulated,
      simulation_run_id        = COALESCE(EXCLUDED.simulation_run_id, public.claim_records.simulation_run_id),
      updated_at               = now();

    UPDATE public.trip_records SET claim_creation_status = 'created' WHERE id = NEW.id;

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

-- Backfill existing claims missing HCPCS, using the trip context
UPDATE public.claim_records cr
SET hcpcs_codes = ARRAY[public.derive_ambulance_hcpcs(tr.service_level, COALESCE(tr.is_emergency_pcr, false))],
    hcpcs_modifiers = ARRAY[
      public.derive_ambulance_modifier_letter(tr.origin_type)
      || public.derive_ambulance_modifier_letter(tr.destination_type)
    ],
    updated_at = now()
FROM public.trip_records tr
WHERE cr.trip_id = tr.id
  AND COALESCE(cr.hcpcs_manually_set, false) = false
  AND (cr.hcpcs_codes IS NULL OR array_length(cr.hcpcs_codes, 1) IS NULL);
