-- Cleanup test helpers from prior verification migration
DROP FUNCTION IF EXISTS public.__test_force_claim_failure();
DROP FUNCTION IF EXISTS public.auto_create_claim_on_pcr_submit_BACKUP();

-- Fix: trip_records uses `is_emergency_pcr`, claim_records uses `has_emergency_event`
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
             COALESCE(p.pcs_on_file, false)
        INTO v_payer_type, v_member_id, v_pcs_on_file
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

    INSERT INTO public.claim_records (
      trip_id, patient_id, run_date, company_id, origin_type, destination_type,
      origin_address, origin_zip, destination_address, destination_zip,
      pcs_document_on_file, payer_type, member_id, icd10_codes, has_emergency_event,
      chief_complaint, primary_impression, medical_necessity_reason, service_level, status
    )
    VALUES (
      NEW.id, NEW.patient_id, NEW.run_date, NEW.company_id, NEW.origin_type, NEW.destination_type,
      v_origin_addr, v_origin_zip, v_dest_addr, v_dest_zip,
      COALESCE(v_pcs_on_file, false), v_payer_type, v_member_id, NEW.icd10_codes,
      COALESCE(NEW.is_emergency_pcr, false),
      NEW.chief_complaint, NEW.primary_impression, NEW.medical_necessity_reason,
      NEW.service_level, 'ready_to_bill'::claim_status
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

-- Re-fire the trigger on our test trip to confirm success path
UPDATE public.trip_records SET pcr_status = 'draft'
WHERE id = '58383f7d-745b-4458-ba89-dca8e3e6e032';
UPDATE public.trip_records SET pcr_status = 'submitted'
WHERE id = '58383f7d-745b-4458-ba89-dca8e3e6e032';