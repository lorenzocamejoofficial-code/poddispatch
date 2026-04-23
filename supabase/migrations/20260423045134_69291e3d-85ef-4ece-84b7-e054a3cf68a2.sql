-- ============================================================
-- 837P Compliance Hardening Migration
-- Adds address + PCS snapshot to claim_records
-- Adds submitter/receiver IDs to clearinghouse_settings
-- Updates auto_create_claim_on_pcr_submit to populate new fields
-- Backfills in-flight claims so existing pipeline keeps working
-- ============================================================

-- 1. Address + PCS snapshot columns on claim_records
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS origin_address text,
  ADD COLUMN IF NOT EXISTS origin_city text,
  ADD COLUMN IF NOT EXISTS origin_state text,
  ADD COLUMN IF NOT EXISTS destination_address text,
  ADD COLUMN IF NOT EXISTS destination_city text,
  ADD COLUMN IF NOT EXISTS destination_state text,
  ADD COLUMN IF NOT EXISTS pcs_document_on_file boolean,
  ADD COLUMN IF NOT EXISTS pcs_attachment_control_number text;

COMMENT ON COLUMN public.claim_records.pcs_document_on_file IS
  'Snapshot of patient.pcs_on_file at claim-creation time. Drives PWK segment emission once Office Ally confirms convention.';
COMMENT ON COLUMN public.claim_records.pcs_attachment_control_number IS
  'PWK06 attachment control number. NULL until PWK convention is confirmed with Office Ally (deferred).';

-- 2. Per-company submitter / receiver identification on clearinghouse_settings
ALTER TABLE public.clearinghouse_settings
  ADD COLUMN IF NOT EXISTS submitter_id text,
  ADD COLUMN IF NOT EXISTS submitter_name text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS receiver_id text NOT NULL DEFAULT 'OFFICEALLY';

COMMENT ON COLUMN public.clearinghouse_settings.submitter_id IS
  'ISA06/GS02 sender ID assigned by clearinghouse. Required for production submissions.';
COMMENT ON COLUMN public.clearinghouse_settings.receiver_id IS
  'ISA08/GS03 receiver ID. Defaults to OFFICEALLY but configurable per clearinghouse.';

-- 3. Update auto_create_claim_on_pcr_submit to snapshot addresses + PCS flag
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
  v_patient    record;
  v_origin_addr text;
  v_dest_addr text;
  v_origin_zip text;
  v_dest_zip text;
  v_pcs_on_file boolean;
BEGIN
  IF NEW.pcr_status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF OLD.pcr_status IS NOT DISTINCT FROM NEW.pcr_status THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Resolve payer + member_id from the patient first
    IF NEW.patient_id IS NOT NULL THEN
      SELECT lower(trim(COALESCE(p.primary_payer, 'default'))),
             p.member_id,
             COALESCE(p.pcs_on_file, false)
        INTO v_payer_type, v_member_id, v_pcs_on_file
        FROM public.patients p
       WHERE p.id = NEW.patient_id;
    END IF;

    -- One-off fallback
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

    -- Trip-level overrides win
    IF NEW.member_id IS NOT NULL AND length(trim(NEW.member_id)) > 0 THEN
      v_member_id := NEW.member_id;
    END IF;
    IF NEW.primary_payer IS NOT NULL AND length(trim(NEW.primary_payer)) > 0 THEN
      v_payer_type := lower(trim(NEW.primary_payer));
    END IF;

    v_payer_type := lower(trim(COALESCE(v_payer_type, 'default')));
    IF v_payer_type = '' THEN v_payer_type := 'default'; END IF;

    -- Snapshot pickup/dropoff addresses from the trip itself.
    -- Trip stores combined "Facility 123 St City ST 00000" strings; we snapshot
    -- as-is and let the EDI generator parse them into N3/N4 segments. Storing
    -- the raw string preserves whatever was on the run.
    v_origin_addr := NEW.pickup_location;
    v_dest_addr   := NEW.destination_location;

    -- Extract ZIPs from the address strings (5 digits)
    v_origin_zip := substring(coalesce(v_origin_addr, '') from '\d{5}');
    v_dest_zip   := substring(coalesce(v_dest_addr, '') from '\d{5}');

    INSERT INTO public.claim_records (
      trip_id,
      patient_id,
      run_date,
      company_id,
      origin_type,
      destination_type,
      origin_address,
      origin_zip,
      destination_address,
      destination_zip,
      pcs_document_on_file,
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
      v_origin_addr,
      v_origin_zip,
      v_dest_addr,
      v_dest_zip,
      COALESCE(v_pcs_on_file, false),
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

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_claim_on_pcr_submit failed for trip %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 4. Backfill in-flight claims with addresses + PCS flag from their parent trip/patient
UPDATE public.claim_records cr
SET
  origin_address       = COALESCE(cr.origin_address, t.pickup_location),
  destination_address  = COALESCE(cr.destination_address, t.destination_location),
  origin_zip           = COALESCE(cr.origin_zip, substring(t.pickup_location from '\d{5}')),
  destination_zip      = COALESCE(cr.destination_zip, substring(t.destination_location from '\d{5}')),
  pcs_document_on_file = COALESCE(cr.pcs_document_on_file, p.pcs_on_file, false)
FROM public.trip_records t
LEFT JOIN public.patients p ON p.id = t.patient_id
WHERE cr.trip_id = t.id
  AND (
    cr.origin_address IS NULL
    OR cr.destination_address IS NULL
    OR cr.pcs_document_on_file IS NULL
  );