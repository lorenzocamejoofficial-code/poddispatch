
-- 1. vehicle_inspection_templates
CREATE TABLE public.vehicle_inspection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  enabled_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  gate_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, truck_id)
);
ALTER TABLE public.vehicle_inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inspection templates"
  ON public.vehicle_inspection_templates FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage inspection templates"
  ON public.vehicle_inspection_templates FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Company members read inspection templates"
  ON public.vehicle_inspection_templates FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- 2. vehicle_inspections
CREATE TABLE public.vehicle_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_by uuid NOT NULL,
  submitted_by_name text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  items_checked jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_items integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'complete',
  UNIQUE(company_id, truck_id, run_date)
);
ALTER TABLE public.vehicle_inspections ENABLE ROW LEVEL SECURITY;

-- Owner, dispatcher, billing can read all for company
CREATE POLICY "Admins read inspections"
  ON public.vehicle_inspections FOR SELECT TO authenticated
  USING (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read inspections"
  ON public.vehicle_inspections FOR SELECT TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Billing read inspections"
  ON public.vehicle_inspections FOR SELECT TO authenticated
  USING (is_billing() AND company_id = get_my_company_id());

-- Crew can read and insert for their assigned truck today only
CREATE POLICY "Crew read own truck inspections today"
  ON public.vehicle_inspections FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND run_date = CURRENT_DATE
    AND EXISTS (
      SELECT 1 FROM public.crews c
      WHERE c.truck_id = vehicle_inspections.truck_id
        AND c.active_date = CURRENT_DATE
        AND (
          c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Crew insert inspections for assigned truck today"
  ON public.vehicle_inspections FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND run_date = CURRENT_DATE
    AND EXISTS (
      SELECT 1 FROM public.crews c
      WHERE c.truck_id = vehicle_inspections.truck_id
        AND c.active_date = CURRENT_DATE
        AND (
          c.member1_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member2_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          OR c.member3_id = (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        )
    )
  );

-- 3. vehicle_inspection_alerts
CREATE TABLE public.vehicle_inspection_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inspection_id uuid NOT NULL REFERENCES public.vehicle_inspections(id) ON DELETE CASCADE,
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  missing_item_key text NOT NULL,
  missing_item_label text NOT NULL,
  crew_note text,
  acknowledged_by uuid,
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  dispatcher_response text,
  dispatcher_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_inspection_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inspection alerts"
  ON public.vehicle_inspection_alerts FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage inspection alerts"
  ON public.vehicle_inspection_alerts FOR ALL TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

-- Crew can insert alerts (when submitting inspection with missing items)
CREATE POLICY "Crew insert inspection alerts"
  ON public.vehicle_inspection_alerts FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND run_date = CURRENT_DATE
  );
