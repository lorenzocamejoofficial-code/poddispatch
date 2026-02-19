
-- 1. Create companies table (no RLS policies yet - added after column exists)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Add company_id to profiles FIRST
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 3. Add company_id to all data tables
ALTER TABLE public.patients        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.trucks          ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.crews           ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.runs            ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.alerts          ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.scheduling_legs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.truck_run_slots ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 4. Seed a default company
INSERT INTO public.companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company')
ON CONFLICT (id) DO NOTHING;

-- 5. Assign all existing rows to the default company
UPDATE public.profiles        SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.patients        SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.trucks          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.crews           SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.runs            SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.alerts          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.scheduling_legs SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.truck_run_slots SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- 6. Helper: get calling user's company_id (security definer avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 7. RLS policies for companies table (company_id column now exists)
CREATE POLICY "Members read own company"
  ON public.companies FOR SELECT
  USING (id = public.get_my_company_id());

CREATE POLICY "Admins update own company"
  ON public.companies FOR UPDATE
  USING (id = public.get_my_company_id() AND public.is_admin());

-- 8. Replace RLS policies with company-scoped versions

-- patients
DROP POLICY IF EXISTS "Admins manage patients"       ON public.patients;
DROP POLICY IF EXISTS "Crew read assigned patients"   ON public.patients;

CREATE POLICY "Admins manage patients"
  ON public.patients FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read assigned patients"
  ON public.patients FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM runs r JOIN crews c ON r.crew_id = c.id
      WHERE r.patient_id = patients.id
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- trucks
DROP POLICY IF EXISTS "Admins manage trucks" ON public.trucks;
DROP POLICY IF EXISTS "Crew read trucks"     ON public.trucks;

CREATE POLICY "Admins manage trucks"
  ON public.trucks FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read trucks"
  ON public.trucks FOR SELECT
  USING (company_id = get_my_company_id());

-- crews
DROP POLICY IF EXISTS "Admins manage crews" ON public.crews;
DROP POLICY IF EXISTS "Crew read crews"     ON public.crews;

CREATE POLICY "Admins manage crews"
  ON public.crews FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read crews"
  ON public.crews FOR SELECT
  USING (company_id = get_my_company_id());

-- runs
DROP POLICY IF EXISTS "Admins manage runs"   ON public.runs;
DROP POLICY IF EXISTS "Crew read own runs"   ON public.runs;
DROP POLICY IF EXISTS "Crew update own runs" ON public.runs;

CREATE POLICY "Admins manage runs"
  ON public.runs FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read own runs"
  ON public.runs FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM crews c WHERE c.id = runs.crew_id
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Crew update own runs"
  ON public.runs FOR UPDATE
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM crews c WHERE c.id = runs.crew_id
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- alerts
DROP POLICY IF EXISTS "Admins manage alerts"   ON public.alerts;
DROP POLICY IF EXISTS "Crew read own alerts"   ON public.alerts;

CREATE POLICY "Admins manage alerts"
  ON public.alerts FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read own alerts"
  ON public.alerts FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM crews c
      WHERE c.truck_id = alerts.truck_id
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- scheduling_legs
DROP POLICY IF EXISTS "Admins manage scheduling_legs" ON public.scheduling_legs;
DROP POLICY IF EXISTS "Crew read assigned legs"        ON public.scheduling_legs;

CREATE POLICY "Admins manage scheduling_legs"
  ON public.scheduling_legs FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read assigned legs"
  ON public.scheduling_legs FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM truck_run_slots trs
        JOIN crews c ON (c.truck_id = trs.truck_id AND c.active_date = scheduling_legs.run_date)
      WHERE trs.leg_id = scheduling_legs.id
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- truck_run_slots
DROP POLICY IF EXISTS "Admins manage truck_run_slots" ON public.truck_run_slots;
DROP POLICY IF EXISTS "Crew read own slots"            ON public.truck_run_slots;
DROP POLICY IF EXISTS "Crew update own slots"          ON public.truck_run_slots;

CREATE POLICY "Admins manage truck_run_slots"
  ON public.truck_run_slots FOR ALL
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Crew read own slots"
  ON public.truck_run_slots FOR SELECT
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM crews c
      WHERE c.truck_id = truck_run_slots.truck_id
        AND c.active_date = truck_run_slots.run_date
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Crew update own slots"
  ON public.truck_run_slots FOR UPDATE
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM crews c
      WHERE c.truck_id = truck_run_slots.truck_id
        AND c.active_date = truck_run_slots.run_date
        AND (
          c.member1_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR c.member2_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );
