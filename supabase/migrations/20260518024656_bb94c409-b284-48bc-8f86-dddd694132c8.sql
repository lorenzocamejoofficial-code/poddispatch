
CREATE OR REPLACE FUNCTION public.sync_claim_review_status_from_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_warning boolean;
BEGIN
  has_warning :=
    NEW.stretcher_placement IS NULL OR NEW.stretcher_placement = ''
    OR NEW.patient_mobility IS NULL OR NEW.patient_mobility = ''
    OR NEW.odometer_at_destination IS NULL OR NEW.odometer_at_destination <= 0;

  IF has_warning THEN
    UPDATE public.claim_records
       SET status = 'needs_review'
     WHERE trip_id = NEW.id
       AND status = 'ready_to_bill';
  ELSE
    UPDATE public.claim_records
       SET status = 'ready_to_bill'
     WHERE trip_id = NEW.id
       AND status = 'needs_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_claim_review_status ON public.trip_records;
CREATE TRIGGER trg_sync_claim_review_status
AFTER INSERT OR UPDATE OF stretcher_placement, patient_mobility, odometer_at_destination
ON public.trip_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_claim_review_status_from_trip();

CREATE OR REPLACE FUNCTION public.sync_claim_review_status_on_claim_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_warning boolean;
BEGIN
  IF NEW.status <> 'ready_to_bill' OR NEW.trip_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT (t.stretcher_placement IS NULL OR t.stretcher_placement = ''
       OR t.patient_mobility IS NULL OR t.patient_mobility = ''
       OR t.odometer_at_destination IS NULL OR t.odometer_at_destination <= 0)
    INTO has_warning
    FROM public.trip_records t
   WHERE t.id = NEW.trip_id;

  IF has_warning THEN
    NEW.status := 'needs_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_claim_review_on_insert ON public.claim_records;
CREATE TRIGGER trg_sync_claim_review_on_insert
BEFORE INSERT ON public.claim_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_claim_review_status_on_claim_insert();

-- Backfill existing claims
UPDATE public.claim_records cr
   SET status = 'needs_review'
  FROM public.trip_records t
 WHERE cr.trip_id = t.id
   AND cr.status = 'ready_to_bill'
   AND (t.stretcher_placement IS NULL OR t.stretcher_placement = ''
     OR t.patient_mobility IS NULL OR t.patient_mobility = ''
     OR t.odometer_at_destination IS NULL OR t.odometer_at_destination <= 0);

UPDATE public.claim_records cr
   SET status = 'ready_to_bill'
  FROM public.trip_records t
 WHERE cr.trip_id = t.id
   AND cr.status = 'needs_review'
   AND t.stretcher_placement IS NOT NULL AND t.stretcher_placement <> ''
   AND t.patient_mobility IS NOT NULL AND t.patient_mobility <> ''
   AND t.odometer_at_destination IS NOT NULL AND t.odometer_at_destination > 0;
