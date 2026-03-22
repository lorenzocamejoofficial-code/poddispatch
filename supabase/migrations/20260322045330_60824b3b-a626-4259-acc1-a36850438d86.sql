
CREATE POLICY "Crew insert trip_records for assigned runs"
ON public.trip_records
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_my_company_id()
  AND EXISTS (
    SELECT 1
    FROM truck_run_slots trs
    JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (
        c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
  )
);
