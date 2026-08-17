-- 1) Widen the crew patients read window to tolerate local/UTC day skew.
DROP POLICY IF EXISTS "Crew read assigned patients today" ON public.patients;

CREATE POLICY "Crew read assigned patients today"
ON public.patients
FOR SELECT
USING (
  company_id = (SELECT public.get_my_company_id())
  AND (
    EXISTS (
      SELECT 1
      FROM public.scheduling_legs sl
      JOIN public.truck_run_slots trs ON trs.leg_id = sl.id
      JOIN public.crews c ON c.truck_id = trs.truck_id AND c.active_date = trs.run_date
      WHERE sl.patient_id = patients.id
        AND trs.run_date BETWEEN (CURRENT_DATE - 1) AND (CURRENT_DATE + 1)
        AND (
          c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.trip_records tr
      JOIN public.crews c ON c.truck_id = tr.truck_id AND c.active_date = tr.run_date
      WHERE tr.patient_id = patients.id
        AND tr.run_date BETWEEN (CURRENT_DATE - 1) AND (CURRENT_DATE + 1)
        AND (
          c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.trip_records tr
      JOIN public.crews c ON c.id = tr.crew_id
      WHERE tr.patient_id = patients.id
        AND tr.pcr_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'kicked_back'::text])
        AND (
          c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        )
    )
  )
);

-- 2) Allow admins/dispatchers who are genuinely the assigned crew to read their own slots.
DROP POLICY IF EXISTS "Crew read own slots" ON public.truck_run_slots;

CREATE POLICY "Crew read own slots"
ON public.truck_run_slots
FOR SELECT
USING (
  company_id = (SELECT public.get_my_company_id())
  AND EXISTS (
    SELECT 1
    FROM public.crews c
    WHERE c.truck_id = truck_run_slots.truck_id
      AND c.active_date = truck_run_slots.run_date
      AND (
        (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = (SELECT auth.uid())) = c.member1_id
        OR (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = (SELECT auth.uid())) = c.member2_id
        OR (SELECT profiles.id FROM public.profiles WHERE profiles.user_id = (SELECT auth.uid())) = c.member3_id
      )
  )
);