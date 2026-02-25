
-- ============================================================
-- Safe Handling & Readiness Engine — Schema additions
-- ============================================================

-- 1) PATIENTS: Add operational needs fields
ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS stairs_required text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS stair_chair_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oxygen_lpm numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS special_equipment_required text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dialysis_window_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS must_arrive_by time WITHOUT TIME ZONE DEFAULT NULL;

-- 2) PROFILES: Add crew capability fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS max_safe_team_lift_lbs integer NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS stair_chair_trained boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bariatric_trained boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS oxygen_handling_trained boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lift_assist_ok boolean NOT NULL DEFAULT false;

-- 3) TRUCKS: Add equipment flags
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS has_power_stretcher boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_stair_chair boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_bariatric_kit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_oxygen_mount boolean NOT NULL DEFAULT false;

-- 4) TRIP_RECORDS: Add pcr_type field
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS pcr_type text DEFAULT NULL;

-- 5) SAFETY_OVERRIDES: Audit table for dispatcher overrides
CREATE TABLE IF NOT EXISTS public.safety_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_record_id uuid REFERENCES public.trip_records(id) ON DELETE CASCADE,
  leg_id uuid REFERENCES public.scheduling_legs(id) ON DELETE CASCADE,
  slot_id uuid REFERENCES public.truck_run_slots(id) ON DELETE CASCADE,
  override_status text NOT NULL,
  reasons text[] NOT NULL DEFAULT '{}',
  override_reason text NOT NULL,
  overridden_by uuid NOT NULL,
  overridden_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage safety_overrides"
  ON public.safety_overrides FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers manage safety_overrides"
  ON public.safety_overrides FOR ALL
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "System creator read safety_overrides"
  ON public.safety_overrides FOR SELECT
  USING (is_system_creator());
