
-- Add severity and flag_type columns to qa_reviews
ALTER TABLE public.qa_reviews ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'yellow';
ALTER TABLE public.qa_reviews ADD COLUMN IF NOT EXISTS flag_type text;

-- RLS: Dispatchers manage qa_reviews
CREATE POLICY "Dispatchers manage qa_reviews" ON public.qa_reviews FOR ALL TO authenticated
USING (is_dispatcher() AND company_id = get_my_company_id())
WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

-- RLS: Billing manage qa_reviews
CREATE POLICY "Billing manage qa_reviews" ON public.qa_reviews FOR ALL TO authenticated
USING (is_billing() AND company_id = get_my_company_id())
WITH CHECK (is_billing() AND company_id = get_my_company_id());

-- Auto-flag trigger function
CREATE OR REPLACE FUNCTION public.auto_flag_trip_qa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_patient record;
  v_ts_arr timestamptz[];
  v_min_ts timestamptz;
  v_max_ts timestamptz;
  v_odo_miles numeric;
  v_weekly_count int;
  v_week_start date;
  v_pcs_required boolean;
BEGIN
  IF NEW.status NOT IN ('completed', 'ready_for_billing') THEN RETURN NEW; END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  BEGIN
    DELETE FROM public.qa_reviews WHERE trip_id = NEW.id AND status = 'pending' AND flag_type IS NOT NULL;

    -- RED: Missing timestamps
    IF NEW.dispatch_time IS NULL THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Dispatch time not recorded. This trip cannot be billed without a documented dispatch time.', 'red', 'missing_dispatch_time', 'pending');
    END IF;
    IF NEW.at_scene_time IS NULL THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'At Scene time not recorded. Billing requires documentation of when the crew arrived at the pickup location.', 'red', 'missing_at_scene_time', 'pending');
    END IF;
    IF NEW.left_scene_time IS NULL THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Left Scene time not recorded. This timestamp is required to calculate transport duration for billing.', 'red', 'missing_left_scene_time', 'pending');
    END IF;
    IF NEW.arrived_dropoff_at IS NULL THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Arrival at destination not recorded. Billing requires documentation of when the patient was delivered.', 'red', 'missing_arrived_dropoff', 'pending');
    END IF;
    IF NEW.in_service_time IS NULL THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'In Service time not recorded. This timestamp is required to close out the transport record.', 'red', 'missing_in_service_time', 'pending');
    END IF;

    -- RED: No medical necessity
    IF COALESCE(NEW.bed_confined, false) IS FALSE
       AND COALESCE(NEW.cannot_transfer_safely, false) IS FALSE
       AND COALESCE(NEW.requires_monitoring, false) IS FALSE
       AND COALESCE(NEW.oxygen_during_transport, false) IS FALSE THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'No medical necessity criteria selected. Medicare requires at least one criterion to support ambulance-level transport.', 'red', 'no_medical_necessity', 'pending');
    END IF;

    -- RED: Missing signature
    IF NEW.signatures_json IS NULL OR NEW.signatures_json = '[]'::jsonb OR jsonb_array_length(COALESCE(NEW.signatures_json, '[]'::jsonb)) = 0 THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'No crew signature on the PCR. A signed patient care report is required for billing submission.', 'red', 'missing_signature', 'pending');
    END IF;

    -- RED: Missing loaded miles
    IF NEW.loaded_miles IS NULL OR NEW.loaded_miles = 0 THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Loaded miles not recorded. This trip cannot be billed without documented mileage.', 'red', 'missing_loaded_miles', 'pending');
    END IF;

    -- RED: Both odometers null
    IF NEW.odometer_at_scene IS NULL AND NEW.odometer_at_destination IS NULL THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Both odometer readings are missing. At least scene and destination odometer values are required for a completed trip.', 'red', 'missing_odometers', 'pending');
    END IF;

    -- RED: PCS missing/expired
    IF NEW.patient_id IS NOT NULL THEN
      SELECT * INTO v_patient FROM public.patients WHERE id = NEW.patient_id;
      IF v_patient IS NOT NULL THEN
        v_pcs_required := false;
        IF EXISTS (
          SELECT 1 FROM public.payer_billing_rules
          WHERE company_id = NEW.company_id
            AND payer_type = COALESCE(v_patient.primary_payer, 'default')
            AND requires_pcs = true
        ) THEN
          v_pcs_required := true;
        END IF;
        IF v_pcs_required AND (
          v_patient.pcs_on_file IS NOT TRUE
          OR (v_patient.pcs_expiration_date IS NOT NULL AND v_patient.pcs_expiration_date < NEW.run_date)
        ) THEN
          INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
          VALUES (NEW.id, NEW.company_id, 'PCS is missing or expired for this patient. An active Physician Certification Statement is required by the payer for billing.', 'red', 'pcs_missing_expired', 'pending');
        END IF;
      END IF;
    END IF;

    -- YELLOW: Time sequence violations
    IF NEW.dispatch_time IS NOT NULL AND NEW.at_scene_time IS NOT NULL AND NEW.at_scene_time < NEW.dispatch_time THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'At Scene time is earlier than Dispatch time. Verify that timestamps reflect the actual sequence of events.', 'yellow', 'seq_scene_before_dispatch', 'pending');
    END IF;
    IF NEW.at_scene_time IS NOT NULL AND NEW.patient_contact_time IS NOT NULL AND NEW.patient_contact_time < NEW.at_scene_time THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Patient Contact time is earlier than At Scene time. Verify that timestamps reflect the actual sequence of events.', 'yellow', 'seq_contact_before_scene', 'pending');
    END IF;
    IF NEW.patient_contact_time IS NOT NULL AND NEW.left_scene_time IS NOT NULL AND NEW.left_scene_time < NEW.patient_contact_time THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Left Scene time is earlier than Patient Contact time. Verify that timestamps reflect the actual sequence of events.', 'yellow', 'seq_left_before_contact', 'pending');
    END IF;
    IF NEW.left_scene_time IS NOT NULL AND NEW.arrived_dropoff_at IS NOT NULL AND NEW.arrived_dropoff_at < NEW.left_scene_time THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'Arrival at Destination is earlier than Left Scene time. Verify that timestamps reflect the actual sequence of events.', 'yellow', 'seq_arrived_before_left', 'pending');
    END IF;
    IF NEW.arrived_dropoff_at IS NOT NULL AND NEW.in_service_time IS NOT NULL AND NEW.in_service_time < NEW.arrived_dropoff_at THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'In Service time is earlier than Arrival at Destination. Verify that timestamps reflect the actual sequence of events.', 'yellow', 'seq_inservice_before_arrived', 'pending');
    END IF;

    -- YELLOW: All timestamps within 60s
    v_ts_arr := ARRAY[]::timestamptz[];
    IF NEW.dispatch_time IS NOT NULL THEN v_ts_arr := v_ts_arr || NEW.dispatch_time; END IF;
    IF NEW.at_scene_time IS NOT NULL THEN v_ts_arr := v_ts_arr || NEW.at_scene_time; END IF;
    IF NEW.patient_contact_time IS NOT NULL THEN v_ts_arr := v_ts_arr || NEW.patient_contact_time; END IF;
    IF NEW.left_scene_time IS NOT NULL THEN v_ts_arr := v_ts_arr || NEW.left_scene_time; END IF;
    IF NEW.arrived_dropoff_at IS NOT NULL THEN v_ts_arr := v_ts_arr || NEW.arrived_dropoff_at; END IF;
    IF NEW.in_service_time IS NOT NULL THEN v_ts_arr := v_ts_arr || NEW.in_service_time; END IF;
    IF array_length(v_ts_arr, 1) >= 3 THEN
      SELECT min(t), max(t) INTO v_min_ts, v_max_ts FROM unnest(v_ts_arr) AS t;
      IF v_max_ts - v_min_ts < interval '60 seconds' THEN
        INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
        VALUES (NEW.id, NEW.company_id, 'All recorded timestamps are within 60 seconds of each other. Verify that each time reflects when the event actually occurred rather than being entered simultaneously.', 'yellow', 'timestamps_simultaneous', 'pending');
      END IF;
    END IF;

    -- YELLOW: Odometer reversed
    IF NEW.odometer_at_scene IS NOT NULL AND NEW.odometer_at_destination IS NOT NULL AND NEW.odometer_at_destination <= NEW.odometer_at_scene THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, format('Odometer at destination (%s) is less than or equal to odometer at scene (%s). Destination reading should be higher than scene reading.', NEW.odometer_at_destination, NEW.odometer_at_scene), 'yellow', 'odometer_reversed', 'pending');
    END IF;

    -- YELLOW: Mileage mismatch
    IF NEW.odometer_at_scene IS NOT NULL AND NEW.odometer_at_destination IS NOT NULL AND NEW.loaded_miles IS NOT NULL AND NEW.odometer_at_destination > NEW.odometer_at_scene THEN
      v_odo_miles := NEW.odometer_at_destination - NEW.odometer_at_scene;
      IF abs(NEW.loaded_miles - v_odo_miles) > 2 THEN
        INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
        VALUES (NEW.id, NEW.company_id, format('Odometer readings show %s miles but loaded miles field shows %s. These values should match within 2 miles.', round(v_odo_miles, 1), round(NEW.loaded_miles, 1)), 'yellow', 'mileage_mismatch', 'pending');
      END IF;
    END IF;

    -- YELLOW: Duration > 8h
    IF NEW.dispatch_time IS NOT NULL AND NEW.in_service_time IS NOT NULL AND NEW.in_service_time - NEW.dispatch_time > interval '8 hours' THEN
      INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
      VALUES (NEW.id, NEW.company_id, 'In Service time is more than 8 hours after Dispatch time. This may indicate retroactive documentation. Verify that times are accurate.', 'yellow', 'excessive_duration', 'pending');
    END IF;

    -- YELLOW: Weekly transport count > 3
    IF NEW.patient_id IS NOT NULL THEN
      v_week_start := date_trunc('week', NEW.run_date::timestamp)::date;
      SELECT count(*) INTO v_weekly_count
      FROM public.trip_records
      WHERE patient_id = NEW.patient_id
        AND company_id = NEW.company_id
        AND run_date >= v_week_start
        AND run_date < v_week_start + 7
        AND status IN ('completed', 'ready_for_billing')
        AND id != NEW.id;
      IF v_weekly_count >= 3 THEN
        INSERT INTO public.qa_reviews (trip_id, company_id, flag_reason, severity, flag_type, status)
        VALUES (NEW.id, NEW.company_id, format('This patient has %s completed transports this week. Medicare covers dialysis transport up to 3 times weekly. Additional trips require documented justification.', v_weekly_count + 1), 'yellow', 'weekly_transport_limit', 'pending');
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_flag_trip_qa failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_flag_trip_qa ON public.trip_records;
CREATE TRIGGER trg_auto_flag_trip_qa
  AFTER UPDATE ON public.trip_records
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_flag_trip_qa();
