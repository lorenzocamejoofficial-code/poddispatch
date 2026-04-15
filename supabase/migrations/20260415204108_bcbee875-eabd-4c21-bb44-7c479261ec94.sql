
-- Crew can INSERT hold timers for trips on their assigned truck
CREATE POLICY "Crew insert hold_timers"
ON public.hold_timers
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.company_id = hold_timers.company_id
      AND c.active_date = CURRENT_DATE
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

-- Crew can SELECT hold timers for their company
CREATE POLICY "Crew read hold_timers"
ON public.hold_timers
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.company_id = hold_timers.company_id
      AND c.active_date = CURRENT_DATE
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

-- Crew can UPDATE hold timers (to resolve them)
CREATE POLICY "Crew update hold_timers"
ON public.hold_timers
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.company_id = hold_timers.company_id
      AND c.active_date = CURRENT_DATE
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
)
WITH CHECK (
  company_id = public.get_my_company_id()
);
