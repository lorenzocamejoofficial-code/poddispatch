CREATE OR REPLACE FUNCTION public.sync_claim_review_status_from_trip()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Partial PCR fields may demote an unsent claim, never certify readiness.
  IF NEW.stretcher_placement IS NULL OR NEW.stretcher_placement = ''
     OR NEW.patient_mobility IS NULL OR NEW.patient_mobility = ''
     OR NEW.odometer_at_destination IS NULL OR NEW.odometer_at_destination <= 0 THEN
    UPDATE public.claim_records SET status = 'needs_review'
    WHERE trip_id = NEW.id AND company_id = NEW.company_id AND status = 'ready_to_bill';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.sync_claim_review_status_on_claim_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Every newly staged claim awaits the shared application readiness gate.
  IF NEW.status = 'ready_to_bill' THEN NEW.status := 'needs_review'; END IF;
  RETURN NEW;
END;
$$;