
-- Drop the old broad crew read policy
DROP POLICY IF EXISTS "Crew read company patients" ON public.patients;

-- Create scoped crew read policy: crew can only read patients assigned to their truck today
CREATE POLICY "Crew read assigned patients today"
ON public.patients
FOR SELECT
TO authenticated
USING (
  -- Path 1: patient is on a scheduling_leg assigned to crew's truck today
  EXISTS (
    SELECT 1
    FROM public.scheduling_legs sl
    JOIN public.truck_run_slots trs ON trs.leg_id = sl.id
    JOIN public.crews c ON c.truck_id = trs.truck_id AND c.active_date = trs.run_date
    WHERE sl.patient_id = patients.id
      AND trs.run_date = CURRENT_DATE
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
  OR
  -- Path 2: patient is on a trip_record assigned to crew's truck today (covers PCR lookup)
  EXISTS (
    SELECT 1
    FROM public.trip_records tr
    JOIN public.crews c ON c.truck_id = tr.truck_id AND c.active_date = tr.run_date
    WHERE tr.patient_id = patients.id
      AND tr.run_date = CURRENT_DATE
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);
