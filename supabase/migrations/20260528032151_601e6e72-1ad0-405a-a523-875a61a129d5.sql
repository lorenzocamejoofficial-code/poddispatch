
-- 1. claim_creation_failures: restrict SELECT to billing/admin
DROP POLICY IF EXISTS "company_read_own" ON public.claim_creation_failures;
CREATE POLICY "Billing and admins read claim creation failures"
ON public.claim_creation_failures
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin())
);

-- 2. claim_submission_queue: restrict SELECT to billing/admin
DROP POLICY IF EXISTS "Users can view their company queue" ON public.claim_submission_queue;
CREATE POLICY "Billing and admins read submission queue"
ON public.claim_submission_queue
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND (public.is_billing() OR public.is_admin())
);

-- 3. scheduling_legs: add member3_id to crew read policy (preserve profiles.id mapping)
DROP POLICY IF EXISTS "Crew read assigned legs" ON public.scheduling_legs;
CREATE POLICY "Crew read assigned legs"
ON public.scheduling_legs
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1
    FROM public.truck_run_slots trs
    JOIN public.crews c
      ON c.truck_id = trs.truck_id
     AND c.active_date = scheduling_legs.run_date
    WHERE trs.leg_id = scheduling_legs.id
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

-- 4. runs: add member3_id to crew read & update policies (preserve profiles.id mapping)
DROP POLICY IF EXISTS "Crew read own runs" ON public.runs;
CREATE POLICY "Crew read own runs"
ON public.runs
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = runs.crew_id
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Crew update own runs" ON public.runs;
CREATE POLICY "Crew update own runs"
ON public.runs
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = runs.crew_id
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);

-- 5. status_updates: add member3_id to crew read policy (no company_id on this table)
DROP POLICY IF EXISTS "Crew read own status" ON public.status_updates;
CREATE POLICY "Crew read own status"
ON public.status_updates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.runs r
    JOIN public.crews c ON c.id = r.crew_id
    WHERE r.id = status_updates.run_id
      AND (
        c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
  )
);
