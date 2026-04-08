DROP POLICY IF EXISTS "Crew read assigned patients today" ON public.patients;

CREATE POLICY "Crew read assigned patients today" ON public.patients
FOR SELECT TO authenticated
USING (
  -- Today's runs via scheduling_legs
  (EXISTS (
    SELECT 1
    FROM scheduling_legs sl
    JOIN truck_run_slots trs ON trs.leg_id = sl.id
    JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trs.run_date
    WHERE sl.patient_id = patients.id
      AND trs.run_date = CURRENT_DATE
      AND (c.member1_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()))
  ))
  OR
  -- Today's runs via trip_records
  (EXISTS (
    SELECT 1
    FROM trip_records tr
    JOIN crews c ON c.truck_id = tr.truck_id AND c.active_date = tr.run_date
    WHERE tr.patient_id = patients.id
      AND tr.run_date = CURRENT_DATE
      AND (c.member1_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()))
  ))
  OR
  -- Past incomplete PCRs: crew members can read patients for any trip they were assigned to that is not yet submitted
  (EXISTS (
    SELECT 1
    FROM trip_records tr
    JOIN crews c ON c.id = tr.crew_id
    WHERE tr.patient_id = patients.id
      AND tr.pcr_status IN ('not_started', 'in_progress', 'kicked_back')
      AND (c.member1_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()))
  ))
);