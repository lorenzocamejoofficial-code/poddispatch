
-- Add member3_id column to crews table
ALTER TABLE public.crews ADD COLUMN member3_id uuid REFERENCES public.profiles(id);

-- Update the safe_assign_crew function to support member3
CREATE OR REPLACE FUNCTION public.safe_assign_crew(
  p_truck_id uuid,
  p_active_date date,
  p_member1_id uuid DEFAULT NULL,
  p_member2_id uuid DEFAULT NULL,
  p_member3_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_existing_crew record;
  v_member_name text;
  v_other_truck text;
  v_member_ids uuid[];
  v_mid uuid;
BEGIN
  v_company_id := public.get_my_company_id();

  -- Collect non-null member ids
  v_member_ids := ARRAY[]::uuid[];
  IF p_member1_id IS NOT NULL THEN v_member_ids := v_member_ids || p_member1_id; END IF;
  IF p_member2_id IS NOT NULL THEN v_member_ids := v_member_ids || p_member2_id; END IF;
  IF p_member3_id IS NOT NULL THEN v_member_ids := v_member_ids || p_member3_id; END IF;

  -- Check for duplicates among the provided member ids
  IF (SELECT count(DISTINCT x) FROM unnest(v_member_ids) x) < array_length(v_member_ids, 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot assign the same employee to multiple crew slots');
  END IF;

  -- Check each member is not assigned elsewhere on this date
  FOREACH v_mid IN ARRAY v_member_ids LOOP
    SELECT c.id, t.name INTO v_existing_crew
    FROM public.crews c
    JOIN public.trucks t ON t.id = c.truck_id
    WHERE c.active_date = p_active_date
      AND c.truck_id != p_truck_id
      AND c.company_id = v_company_id
      AND (c.member1_id = v_mid OR c.member2_id = v_mid OR c.member3_id = v_mid)
    LIMIT 1;

    IF FOUND THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s is already assigned to %s on this date', v_member_name, v_existing_crew.name));
    END IF;
  END LOOP;

  -- Check no existing crew for this truck+date
  IF EXISTS (
    SELECT 1 FROM public.crews
    WHERE truck_id = p_truck_id
      AND active_date = p_active_date
      AND company_id = v_company_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crew already assigned to this truck on this date');
  END IF;

  -- Insert
  INSERT INTO public.crews (truck_id, member1_id, member2_id, member3_id, active_date, company_id)
  VALUES (p_truck_id, p_member1_id, p_member2_id, p_member3_id, p_active_date, v_company_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Update RLS policies on trip_records to include member3_id
-- Drop and recreate the crew-related policies

DROP POLICY IF EXISTS "Crew read assigned trips" ON public.trip_records;
CREATE POLICY "Crew read assigned trips"
ON public.trip_records
FOR SELECT
TO authenticated
USING (
  (company_id = get_my_company_id()) AND (EXISTS (
    SELECT 1
    FROM truck_run_slots trs
    JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (
        c.member1_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member2_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member3_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
      )
  ))
);

DROP POLICY IF EXISTS "Crew update assigned trips" ON public.trip_records;
CREATE POLICY "Crew update assigned trips"
ON public.trip_records
FOR UPDATE
TO authenticated
USING (
  (company_id = get_my_company_id()) AND (EXISTS (
    SELECT 1
    FROM truck_run_slots trs
    JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (
        c.member1_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member2_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member3_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
      )
  ))
);

DROP POLICY IF EXISTS "Crew insert trip_records for assigned runs" ON public.trip_records;
CREATE POLICY "Crew insert trip_records for assigned runs"
ON public.trip_records
FOR INSERT
TO authenticated
WITH CHECK (
  (company_id = get_my_company_id()) AND (EXISTS (
    SELECT 1
    FROM truck_run_slots trs
    JOIN crews c ON c.truck_id = trs.truck_id AND c.active_date = trip_records.run_date
    WHERE trs.leg_id = trip_records.leg_id
      AND (
        c.member1_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member2_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member3_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
      )
  ))
);

-- Update alerts RLS to include member3
DROP POLICY IF EXISTS "Crew read own alerts" ON public.alerts;
CREATE POLICY "Crew read own alerts"
ON public.alerts
FOR SELECT
TO public
USING (
  (company_id = get_my_company_id()) AND (EXISTS (
    SELECT 1 FROM crews c
    WHERE c.truck_id = alerts.truck_id
      AND (
        c.member1_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member2_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
        OR c.member3_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid())
      )
  ))
);
