UPDATE public.truck_run_slots trs
SET status = 'completed'
WHERE trs.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.trip_records tr
    WHERE tr.leg_id = trs.leg_id
      AND tr.run_date = trs.run_date
      AND tr.pcr_status = 'submitted'
  );