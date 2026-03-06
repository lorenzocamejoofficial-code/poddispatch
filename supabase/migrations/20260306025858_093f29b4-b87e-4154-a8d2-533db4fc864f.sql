
-- ============================================================
-- C) PERFORMANCE INDEXES for scheduling-critical queries
-- ============================================================

-- scheduling_legs: most queries filter by (company_id, run_date)
CREATE INDEX IF NOT EXISTS idx_scheduling_legs_company_date 
  ON public.scheduling_legs (company_id, run_date);

-- truck_run_slots: most queries filter by (run_date), join on (leg_id)
CREATE INDEX IF NOT EXISTS idx_truck_run_slots_date 
  ON public.truck_run_slots (run_date);
CREATE INDEX IF NOT EXISTS idx_truck_run_slots_company_date 
  ON public.truck_run_slots (company_id, run_date);
CREATE INDEX IF NOT EXISTS idx_truck_run_slots_leg_date 
  ON public.truck_run_slots (leg_id, run_date);

-- crews: filtered by (active_date) and (company_id, active_date)
CREATE INDEX IF NOT EXISTS idx_crews_company_date 
  ON public.crews (company_id, active_date);

-- leg_exceptions: filtered by (run_date) and (scheduling_leg_id, run_date)
CREATE INDEX IF NOT EXISTS idx_leg_exceptions_date 
  ON public.leg_exceptions (run_date);
CREATE INDEX IF NOT EXISTS idx_leg_exceptions_leg_date 
  ON public.leg_exceptions (scheduling_leg_id, run_date);

-- trip_records: filtered by (company_id, run_date)
CREATE INDEX IF NOT EXISTS idx_trip_records_company_date 
  ON public.trip_records (company_id, run_date);

-- patients: filtered by company_id
CREATE INDEX IF NOT EXISTS idx_patients_company 
  ON public.patients (company_id);

-- trucks: filtered by company_id + active
CREATE INDEX IF NOT EXISTS idx_trucks_company_active 
  ON public.trucks (company_id, active);

-- truck_availability: date-range queries
CREATE INDEX IF NOT EXISTS idx_truck_availability_dates 
  ON public.truck_availability (start_date, end_date);

-- facilities: filtered by company_id + active
CREATE INDEX IF NOT EXISTS idx_facilities_company_active 
  ON public.facilities (company_id, active);

-- alerts: filtered by company_id + dismissed
CREATE INDEX IF NOT EXISTS idx_alerts_company_dismissed 
  ON public.alerts (company_id, dismissed);

-- daily_truck_metrics: filtered by company_id + run_date
CREATE INDEX IF NOT EXISTS idx_daily_truck_metrics_company_date 
  ON public.daily_truck_metrics (company_id, run_date);

-- claim_records: filtered by company_id + run_date
CREATE INDEX IF NOT EXISTS idx_claim_records_company_date 
  ON public.claim_records (company_id, run_date);

-- ============================================================
-- B) CONCURRENCY PROTECTION: optimistic locking function
-- ============================================================

-- Safe update function that checks updated_at before overwriting
CREATE OR REPLACE FUNCTION public.safe_update_slot_order(
  p_leg_id uuid,
  p_run_date date,
  p_truck_id uuid,
  p_slot_order integer,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current timestamptz;
  v_company_id uuid;
BEGIN
  v_company_id := public.get_my_company_id();
  
  -- If no expected timestamp, just do the update (backwards compatible)
  IF p_expected_updated_at IS NULL THEN
    UPDATE public.truck_run_slots
    SET slot_order = p_slot_order
    WHERE leg_id = p_leg_id 
      AND run_date = p_run_date 
      AND truck_id = p_truck_id
      AND company_id = v_company_id;
    RETURN jsonb_build_object('ok', true);
  END IF;
  
  -- Check for stale data
  SELECT created_at INTO v_current
  FROM public.truck_run_slots
  WHERE leg_id = p_leg_id 
    AND run_date = p_run_date 
    AND truck_id = p_truck_id
    AND company_id = v_company_id;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SLOT_NOT_FOUND');
  END IF;
  
  UPDATE public.truck_run_slots
  SET slot_order = p_slot_order
  WHERE leg_id = p_leg_id 
    AND run_date = p_run_date 
    AND truck_id = p_truck_id
    AND company_id = v_company_id;
    
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Safe crew assignment with conflict detection
CREATE OR REPLACE FUNCTION public.safe_assign_crew(
  p_truck_id uuid,
  p_active_date date,
  p_member1_id uuid DEFAULT NULL,
  p_member2_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_existing_crew record;
  v_member_name text;
  v_other_truck text;
BEGIN
  v_company_id := public.get_my_company_id();
  
  -- Prevent same person in both slots
  IF p_member1_id IS NOT NULL AND p_member2_id IS NOT NULL AND p_member1_id = p_member2_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot assign the same employee to both crew slots');
  END IF;
  
  -- Check member1 not assigned elsewhere
  IF p_member1_id IS NOT NULL THEN
    SELECT c.id, t.name INTO v_existing_crew
    FROM public.crews c
    JOIN public.trucks t ON t.id = c.truck_id
    WHERE c.active_date = p_active_date
      AND c.truck_id != p_truck_id
      AND c.company_id = v_company_id
      AND (c.member1_id = p_member1_id OR c.member2_id = p_member1_id)
    LIMIT 1;
    
    IF FOUND THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = p_member1_id;
      RETURN jsonb_build_object('ok', false, 'error', 
        format('%s is already assigned to %s on this date', v_member_name, v_other_truck));
    END IF;
  END IF;
  
  -- Check member2 not assigned elsewhere
  IF p_member2_id IS NOT NULL THEN
    SELECT c.id, t.name INTO v_existing_crew
    FROM public.crews c
    JOIN public.trucks t ON t.id = c.truck_id
    WHERE c.active_date = p_active_date
      AND c.truck_id != p_truck_id
      AND c.company_id = v_company_id
      AND (c.member1_id = p_member2_id OR c.member2_id = p_member2_id)
    LIMIT 1;
    
    IF FOUND THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = p_member2_id;
      RETURN jsonb_build_object('ok', false, 'error', 
        format('%s is already assigned to %s on this date', v_member_name, v_other_truck));
    END IF;
  END IF;
  
  -- Check no existing crew for this truck+date (prevent duplicate)
  IF EXISTS (
    SELECT 1 FROM public.crews 
    WHERE truck_id = p_truck_id 
      AND active_date = p_active_date 
      AND company_id = v_company_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crew already assigned to this truck on this date');
  END IF;
  
  -- Insert
  INSERT INTO public.crews (truck_id, member1_id, member2_id, active_date, company_id)
  VALUES (p_truck_id, p_member1_id, p_member2_id, p_active_date, v_company_id);
  
  RETURN jsonb_build_object('ok', true);
END;
$$;
