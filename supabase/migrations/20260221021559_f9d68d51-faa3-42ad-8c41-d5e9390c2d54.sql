
-- Add enum values (these auto-commit outside transaction in some cases)
-- Since ADD VALUE can't run in transaction, we use a workaround:
-- Create the role check functions using direct text comparison instead of enum cast

-- Medical necessity columns
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS bed_confined boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cannot_transfer_safely boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_monitoring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oxygen_during_transport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatch_time timestamp with time zone DEFAULT null;

-- Create role check functions using text comparison (avoids enum transaction issue)
CREATE OR REPLACE FUNCTION public.is_dispatcher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'dispatcher'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_billing()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'billing'
  )
$$;

-- trip_records: multi-role access
DROP POLICY IF EXISTS "Admins manage trip_records" ON public.trip_records;

CREATE POLICY "Admins manage trip_records" ON public.trip_records
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage trip_records" ON public.trip_records
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Billing read completed trips" ON public.trip_records
  FOR SELECT TO authenticated
  USING (is_billing() AND company_id = get_my_company_id() AND status IN ('completed', 'ready_for_billing'));

-- claim_records: multi-role
DROP POLICY IF EXISTS "Admins manage claim_records" ON public.claim_records;

CREATE POLICY "Admins manage claim_records" ON public.claim_records
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Billing manage claim_records" ON public.claim_records
  FOR ALL TO authenticated
  USING (is_billing() AND company_id = get_my_company_id())
  WITH CHECK (is_billing() AND company_id = get_my_company_id());

-- patients: dispatcher access
DROP POLICY IF EXISTS "Admins manage patients" ON public.patients;

CREATE POLICY "Admins manage patients" ON public.patients
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage patients" ON public.patients
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

-- Dispatcher access to scheduling, trucks, crews, alerts
CREATE POLICY "Dispatchers manage scheduling_legs" ON public.scheduling_legs
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage truck_run_slots" ON public.truck_run_slots
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read trucks" ON public.trucks
  FOR SELECT TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage crews" ON public.crews
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage alerts" ON public.alerts
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage operational_alerts" ON public.operational_alerts
  FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

-- Crew trip access
CREATE POLICY "Crew update assigned trips" ON public.trip_records
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM truck_run_slots trs
      JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
      WHERE trs.leg_id = trip_records.leg_id
      AND (c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Crew read assigned trips" ON public.trip_records
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM truck_run_slots trs
      JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
      WHERE trs.leg_id = trip_records.leg_id
      AND (c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );
