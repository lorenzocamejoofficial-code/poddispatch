
-- Enforce crew_assignable() gate on all crew assignments

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
  v_member_ids uuid[];
  v_mid uuid;
  v_user_id uuid;
BEGIN
  v_company_id := public.get_my_company_id();

  v_member_ids := ARRAY[]::uuid[];
  IF p_member1_id IS NOT NULL THEN v_member_ids := v_member_ids || p_member1_id; END IF;
  IF p_member2_id IS NOT NULL THEN v_member_ids := v_member_ids || p_member2_id; END IF;
  IF p_member3_id IS NOT NULL THEN v_member_ids := v_member_ids || p_member3_id; END IF;

  IF array_length(v_member_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Select at least one crew member');
  END IF;

  IF (SELECT count(DISTINCT x) FROM unnest(v_member_ids) x) < array_length(v_member_ids, 1) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot assign the same employee to multiple crew slots');
  END IF;

  -- Certification gate: each member must be assignable
  FOREACH v_mid IN ARRAY v_member_ids LOOP
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = v_mid;
    IF v_user_id IS NULL OR NOT public.crew_assignable(v_user_id) THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License). Approve or verify on the Employees → Certifications page.',
          COALESCE(v_member_name, 'Employee')));
    END IF;
  END LOOP;

  -- Conflict: assigned to another truck same date
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

  IF EXISTS (
    SELECT 1 FROM public.crews
    WHERE truck_id = p_truck_id
      AND active_date = p_active_date
      AND company_id = v_company_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crew already assigned to this truck on this date');
  END IF;

  INSERT INTO public.crews (truck_id, member1_id, member2_id, member3_id, active_date, company_id)
  VALUES (p_truck_id, p_member1_id, p_member2_id, p_member3_id, p_active_date, v_company_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Trigger to enforce cert gate on direct INSERT/UPDATE (edit path)
CREATE OR REPLACE FUNCTION public.enforce_crew_cert_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mid uuid;
  v_user_id uuid;
  v_name text;
BEGIN
  FOREACH v_mid IN ARRAY ARRAY[NEW.member1_id, NEW.member2_id, NEW.member3_id] LOOP
    IF v_mid IS NULL THEN CONTINUE; END IF;
    SELECT user_id, full_name INTO v_user_id, v_name FROM public.profiles WHERE id = v_mid;
    IF v_user_id IS NULL OR NOT public.crew_assignable(v_user_id) THEN
      RAISE EXCEPTION '% cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License).',
        COALESCE(v_name, 'Employee');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crews_cert_gate ON public.crews;
CREATE TRIGGER trg_crews_cert_gate
  BEFORE INSERT OR UPDATE OF member1_id, member2_id, member3_id
  ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_crew_cert_gate();
