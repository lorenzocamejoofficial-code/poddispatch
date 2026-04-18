-- 1) Unique index on trip_id (one active claim per trip)
CREATE UNIQUE INDEX IF NOT EXISTS claim_records_trip_id_uidx
  ON public.claim_records (trip_id)
  WHERE trip_id IS NOT NULL;

-- 2) hcpcs_manually_set column to protect biller edits from bulk refresh
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS hcpcs_manually_set boolean NOT NULL DEFAULT false;

-- 3) Trigger function: auto-create claim_records when pcr_status transitions to 'submitted'
CREATE OR REPLACE FUNCTION public.auto_create_claim_on_pcr_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_payer_type text;
  v_member_id  text;
BEGIN
  IF NEW.pcr_status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF OLD.pcr_status IS NOT DISTINCT FROM NEW.pcr_status THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NEW.patient_id IS NOT NULL THEN
      SELECT lower(COALESCE(p.primary_payer, 'default')),
             p.primary_member_id
        INTO v_payer_type, v_member_id
        FROM public.patients p
       WHERE p.id = NEW.patient_id;
    END IF;

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
      status
    )
    VALUES (
      NEW.id,
      NEW.patient_id,
      NEW.run_date,
      NEW.company_id,
      NEW.origin_type,
      NEW.destination_type,
      COALESCE(v_payer_type, 'default'),
      v_member_id,
      NEW.icd10_codes,
      COALESCE(NEW.has_emergency_event, false),
      'ready_to_bill'::claim_status
    )
    ON CONFLICT (trip_id) WHERE trip_id IS NOT NULL
    DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_claim_on_pcr_submit failed for trip %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 4) Trigger: AFTER UPDATE on trip_records.pcr_status
DROP TRIGGER IF EXISTS trg_auto_create_claim_on_pcr_submit ON public.trip_records;
CREATE TRIGGER trg_auto_create_claim_on_pcr_submit
  AFTER UPDATE OF pcr_status ON public.trip_records
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_claim_on_pcr_submit();