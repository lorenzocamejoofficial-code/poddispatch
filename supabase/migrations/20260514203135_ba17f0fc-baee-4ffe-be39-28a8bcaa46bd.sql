-- =========================================================
-- RLS performance optimization. Pure rewrite — no semantic change.
-- Pattern: wrap STABLE auth helpers in (SELECT ...) so they evaluate
-- once per query as InitPlans instead of once per row. For trip_records
-- and truck_run_slots, also short-circuit the Crew EXISTS branch for
-- admins/dispatchers (who already see the row via separate permissive
-- policies), and collapse three correlated profile subselects into one.
-- =========================================================

-- ---------- trip_records ----------
DROP POLICY IF EXISTS "Crew read assigned trips" ON public.trip_records;
CREATE POLICY "Crew read assigned trips" ON public.trip_records
FOR SELECT TO authenticated
USING (
  company_id = (SELECT public.get_my_company_id())
  AND NOT (SELECT public.is_admin())
  AND NOT (SELECT public.is_dispatcher())
  AND EXISTS (
    SELECT 1
    FROM public.truck_run_slots trs
    JOIN public.crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
          IN (c.member1_id, c.member2_id, c.member3_id)
  )
);

DROP POLICY IF EXISTS "Crew update assigned trips" ON public.trip_records;
CREATE POLICY "Crew update assigned trips" ON public.trip_records
FOR UPDATE TO authenticated
USING (
  company_id = (SELECT public.get_my_company_id())
  AND NOT (SELECT public.is_admin())
  AND NOT (SELECT public.is_dispatcher())
  AND EXISTS (
    SELECT 1
    FROM public.truck_run_slots trs
    JOIN public.crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
          IN (c.member1_id, c.member2_id, c.member3_id)
  )
);

DROP POLICY IF EXISTS "Crew insert trip_records for assigned runs" ON public.trip_records;
CREATE POLICY "Crew insert trip_records for assigned runs" ON public.trip_records
FOR INSERT TO authenticated
WITH CHECK (
  company_id = (SELECT public.get_my_company_id())
  AND EXISTS (
    SELECT 1
    FROM public.truck_run_slots trs
    JOIN public.crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
          IN (c.member1_id, c.member2_id, c.member3_id)
  )
);

DROP POLICY IF EXISTS "Admins manage trip_records" ON public.trip_records;
CREATE POLICY "Admins manage trip_records" ON public.trip_records
FOR ALL TO authenticated
USING ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()))
WITH CHECK ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Dispatchers manage trip_records" ON public.trip_records;
CREATE POLICY "Dispatchers manage trip_records" ON public.trip_records
FOR ALL TO authenticated
USING ((SELECT public.is_dispatcher()) AND company_id = (SELECT public.get_my_company_id()))
WITH CHECK ((SELECT public.is_dispatcher()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Billing read completed trips" ON public.trip_records;
CREATE POLICY "Billing read completed trips" ON public.trip_records
FOR SELECT TO authenticated
USING (
  (SELECT public.is_billing())
  AND company_id = (SELECT public.get_my_company_id())
  AND status = ANY (ARRAY['completed'::trip_status, 'ready_for_billing'::trip_status])
);

DROP POLICY IF EXISTS "Billing update trip_records for overrides" ON public.trip_records;
CREATE POLICY "Billing update trip_records for overrides" ON public.trip_records
FOR UPDATE TO public
USING ((SELECT public.is_billing()) AND company_id = (SELECT public.get_my_company_id()))
WITH CHECK ((SELECT public.is_billing()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "System creator read trips" ON public.trip_records;
CREATE POLICY "System creator read trips" ON public.trip_records
FOR SELECT TO authenticated
USING ((SELECT public.is_system_creator()));

DROP POLICY IF EXISTS "realtime_trip_records" ON public.trip_records;
CREATE POLICY "realtime_trip_records" ON public.trip_records
FOR SELECT TO authenticated
USING (company_id = (SELECT public.get_my_company_id()));

-- ---------- truck_run_slots ----------
DROP POLICY IF EXISTS "Crew read own slots" ON public.truck_run_slots;
CREATE POLICY "Crew read own slots" ON public.truck_run_slots
FOR SELECT TO public
USING (
  company_id = (SELECT public.get_my_company_id())
  AND NOT (SELECT public.is_admin())
  AND NOT (SELECT public.is_dispatcher())
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.truck_id = truck_run_slots.truck_id
      AND c.active_date = truck_run_slots.run_date
      AND (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
          IN (c.member1_id, c.member2_id, c.member3_id)
  )
);

DROP POLICY IF EXISTS "Crew update own slots" ON public.truck_run_slots;
CREATE POLICY "Crew update own slots" ON public.truck_run_slots
FOR UPDATE TO public
USING (
  company_id = (SELECT public.get_my_company_id())
  AND NOT (SELECT public.is_admin())
  AND NOT (SELECT public.is_dispatcher())
  AND EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.truck_id = truck_run_slots.truck_id
      AND c.active_date = truck_run_slots.run_date
      AND (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid()))
          IN (c.member1_id, c.member2_id, c.member3_id)
  )
);

DROP POLICY IF EXISTS "Admins manage truck_run_slots" ON public.truck_run_slots;
CREATE POLICY "Admins manage truck_run_slots" ON public.truck_run_slots
FOR ALL TO public
USING ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Dispatchers manage truck_run_slots" ON public.truck_run_slots;
CREATE POLICY "Dispatchers manage truck_run_slots" ON public.truck_run_slots
FOR ALL TO authenticated
USING ((SELECT public.is_dispatcher()) AND company_id = (SELECT public.get_my_company_id()))
WITH CHECK ((SELECT public.is_dispatcher()) AND company_id = (SELECT public.get_my_company_id()));

-- ---------- trucks ----------
DROP POLICY IF EXISTS "Admins manage trucks" ON public.trucks;
CREATE POLICY "Admins manage trucks" ON public.trucks
FOR ALL TO public
USING ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Crew read trucks" ON public.trucks;
CREATE POLICY "Crew read trucks" ON public.trucks
FOR SELECT TO public
USING (company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Dispatchers read trucks" ON public.trucks;
CREATE POLICY "Dispatchers read trucks" ON public.trucks
FOR SELECT TO authenticated
USING ((SELECT public.is_dispatcher()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "System creator read trucks count" ON public.trucks;
CREATE POLICY "System creator read trucks count" ON public.trucks
FOR SELECT TO authenticated
USING ((SELECT public.is_system_creator()));

-- ---------- claim_records ----------
DROP POLICY IF EXISTS "Admins manage claim_records" ON public.claim_records;
CREATE POLICY "Admins manage claim_records" ON public.claim_records
FOR ALL TO authenticated
USING ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()))
WITH CHECK ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Billing manage claim_records" ON public.claim_records;
CREATE POLICY "Billing manage claim_records" ON public.claim_records
FOR ALL TO authenticated
USING ((SELECT public.is_billing()) AND company_id = (SELECT public.get_my_company_id()))
WITH CHECK ((SELECT public.is_billing()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "System creator read claims" ON public.claim_records;
CREATE POLICY "System creator read claims" ON public.claim_records
FOR SELECT TO authenticated
USING ((SELECT public.is_system_creator()));

-- ---------- crews ----------
DROP POLICY IF EXISTS "Admins manage crews" ON public.crews;
CREATE POLICY "Admins manage crews" ON public.crews
FOR ALL TO public
USING ((SELECT public.is_admin()) AND company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Crew read crews" ON public.crews;
CREATE POLICY "Crew read crews" ON public.crews
FOR SELECT TO public
USING (company_id = (SELECT public.get_my_company_id()));

DROP POLICY IF EXISTS "Dispatchers manage crews" ON public.crews;
CREATE POLICY "Dispatchers manage crews" ON public.crews
FOR ALL TO authenticated
USING ((SELECT public.is_dispatcher()) AND company_id = (SELECT public.get_my_company_id()));