-- Fix 4 + Fix 5: add audit/reporting columns to claim_records and keep
-- the auto_create_claim_on_pcr_submit trigger in sync.

ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS primary_impression text,
  ADD COLUMN IF NOT EXISTS medical_necessity_reason text,
  ADD COLUMN IF NOT EXISTS service_level text;

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
BEGIN
  IF NEW.pcr_status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF OLD.pcr_status IS NOT DISTINCT FROM NEW.pcr_status THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Resolve payer + member_id from the patient first (canonical column: member_id)
    IF NEW.patient_id IS NOT NULL THEN
      SELECT lower(trim(COALESCE(p.primary_payer, 'default'))),
             p.member_id
        INTO v_payer_type, v_member_id
        FROM public.patients p
       WHERE p.id = NEW.patient_id;
    END IF;

    -- One-off fallback: if no patient, pull from scheduling_legs.oneoff_*
    IF (v_payer_type IS NULL OR v_member_id IS NULL) AND NEW.leg_id IS NOT NULL THEN
      SELECT oneoff_primary_payer, oneoff_member_id
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

    -- Trip-level overrides win over both (e.g. PCR edit corrected the value)
    IF NEW.member_id IS NOT NULL AND length(trim(NEW.member_id)) > 0 THEN
      v_member_id := NEW.member_id;
    END IF;
    IF NEW.primary_payer IS NOT NULL AND length(trim(NEW.primary_payer)) > 0 THEN
      v_payer_type := lower(trim(NEW.primary_payer));
    END IF;

    v_payer_type := lower(trim(COALESCE(v_payer_type, 'default')));
    IF v_payer_type = '' THEN v_payer_type := 'default'; END IF;

    INSERT INTO public.claim_records (
      trip_id,
      patient_id,
      run_date,
      company_id,
      origin_type,
      destination_type,
      payer_type,
      member_id,
      icd10_codes,
      has_emergency_event,
      chief_complaint,
      primary_impression,
      medical_necessity_reason,
      service_level,
      status
    )
    VALUES (
      NEW.id,
      NEW.patient_id,
      NEW.run_date,
      NEW.company_id,
      NEW.origin_type,
      NEW.destination_type,
      v_payer_type,
      v_member_id,
      NEW.icd10_codes,
      COALESCE(NEW.has_emergency_event, false),
      NEW.chief_complaint,
      NEW.primary_impression,
      NEW.medical_necessity_reason,
      NEW.service_level,
      'ready_to_bill'::claim_status
    )
    ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL
    DO UPDATE SET
      icd10_codes              = EXCLUDED.icd10_codes,
      member_id                = EXCLUDED.member_id,
      payer_type               = EXCLUDED.payer_type,
      origin_type              = EXCLUDED.origin_type,
      destination_type         = EXCLUDED.destination_type,
      has_emergency_event      = EXCLUDED.has_emergency_event,
      chief_complaint          = EXCLUDED.chief_complaint,
      primary_impression       = EXCLUDED.primary_impression,
      medical_necessity_reason = EXCLUDED.medical_necessity_reason,
      service_level            = EXCLUDED.service_level,
      updated_at               = now();
    -- NOTE: status, hcpcs_codes, total_charge, base_charge, mileage_charge,
    -- extras_charge, allowed_amount, amount_paid, submitted_at, etc. remain
    -- biller-owned and are intentionally not overwritten on conflict.

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_claim_on_pcr_submit failed for trip %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;