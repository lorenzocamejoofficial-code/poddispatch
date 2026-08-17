-- Third crew member role + role-aware certification gate

ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS member3_role text;

ALTER TABLE public.crews DROP CONSTRAINT IF EXISTS crews_member3_role_check;
ALTER TABLE public.crews ADD CONSTRAINT crews_member3_role_check
  CHECK (member3_role IS NULL OR member3_role IN ('second_medic','lift_assist','driver','trainee'));

-- member3_role must be present exactly when member3_id is present
CREATE OR REPLACE FUNCTION public.enforce_member3_role_presence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.member3_id IS NOT NULL AND NEW.member3_role IS NULL THEN
    RAISE EXCEPTION 'A role is required for the third crew member (Second Medic, Lift Assist, Driver, or Trainee/Observer).';
  END IF;
  IF NEW.member3_id IS NULL AND NEW.member3_role IS NOT NULL THEN
    NEW.member3_role := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crews_member3_role ON public.crews;
CREATE TRIGGER trg_crews_member3_role
  BEFORE INSERT OR UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member3_role_presence();

-- Role-aware certification gate
CREATE OR REPLACE FUNCTION public.crew_assignable_for_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH valid AS (
    SELECT DISTINCT cert_type::text AS cert_type
    FROM public.crew_certifications
    WHERE user_id = _user_id
      AND status = 'approved'
      AND (
        (expiration_date IS NOT NULL AND expiration_date >= CURRENT_DATE)
        OR (manually_verified = true
            AND (manual_verification_expires_at IS NULL OR manual_verification_expires_at >= CURRENT_DATE))
      )
  )
  SELECT CASE COALESCE(_role, 'primary')
    WHEN 'trainee' THEN true
    WHEN 'lift_assist' THEN EXISTS (SELECT 1 FROM valid WHERE cert_type = 'cpr')
    WHEN 'driver' THEN
      EXISTS (SELECT 1 FROM valid WHERE cert_type = 'cpr')
      AND EXISTS (SELECT 1 FROM valid WHERE cert_type = 'drivers_license')
    ELSE (SELECT count(*) FROM valid) = 3
  END;
$$;

CREATE OR REPLACE FUNCTION public.crew_role_cert_requirement(_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE COALESCE(_role, 'primary')
    WHEN 'trainee' THEN 'no certifications'
    WHEN 'lift_assist' THEN 'CPR'
    WHEN 'driver' THEN 'CPR and Driver''s License'
    ELSE 'Medic #, CPR, Driver''s License'
  END;
$$;

-- Rewire the edit-path trigger to be role aware for the third seat
CREATE OR REPLACE FUNCTION public.enforce_crew_cert_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_name text;
BEGIN
  FOREACH v_user_id IN ARRAY ARRAY[NEW.member1_id, NEW.member2_id] LOOP
    IF v_user_id IS NULL THEN CONTINUE; END IF;
    SELECT p.user_id, p.full_name INTO v_user_id, v_name FROM public.profiles p WHERE p.id = v_user_id;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, 'primary') THEN
      RAISE EXCEPTION '% cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License).',
        COALESCE(v_name, 'Employee');
    END IF;
  END LOOP;

  IF NEW.member3_id IS NOT NULL THEN
    SELECT p.user_id, p.full_name INTO v_user_id, v_name FROM public.profiles p WHERE p.id = NEW.member3_id;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, NEW.member3_role) THEN
      RAISE EXCEPTION '% cannot be assigned as % — missing or expired certifications (requires %).',
        COALESCE(v_name, 'Employee'), COALESCE(NEW.member3_role, 'crew'),
        public.crew_role_cert_requirement(NEW.member3_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crews_cert_gate ON public.crews;
CREATE TRIGGER trg_crews_cert_gate
  BEFORE INSERT OR UPDATE OF member1_id, member2_id, member3_id, member3_role
  ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_crew_cert_gate();

-- New safe_assign_crew overload carrying the third member's role
CREATE OR REPLACE FUNCTION public.safe_assign_crew(
  p_truck_id uuid,
  p_active_date date,
  p_member1_id uuid,
  p_member2_id uuid,
  p_member3_id uuid,
  p_member3_role text
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

  IF p_member3_id IS NOT NULL AND p_member3_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Select a role for the third crew member');
  END IF;

  -- Certification gate: primary seats full strength, third seat by role
  FOREACH v_mid IN ARRAY ARRAY[p_member1_id, p_member2_id] LOOP
    IF v_mid IS NULL THEN CONTINUE; END IF;
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = v_mid;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, 'primary') THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License). Approve or verify on the Employees → Certifications page.',
          COALESCE(v_member_name, 'Employee')));
    END IF;
  END LOOP;

  IF p_member3_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_member3_id;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, p_member3_role) THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = p_member3_id;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s cannot be assigned as %s — missing or expired certifications (requires %s).',
          COALESCE(v_member_name, 'Employee'), p_member3_role,
          public.crew_role_cert_requirement(p_member3_role)));
    END IF;
  END IF;

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

  INSERT INTO public.crews (truck_id, member1_id, member2_id, member3_id, member3_role, active_date, company_id)
  VALUES (p_truck_id, p_member1_id, p_member2_id, p_member3_id, p_member3_role, p_active_date, v_company_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;