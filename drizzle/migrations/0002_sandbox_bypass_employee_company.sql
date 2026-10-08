CREATE OR REPLACE FUNCTION public.sandbox_cert_bypass(_profile_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  -- Keys ONLY on the employee's own company sandbox flag; _company_id kept for signature compatibility.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = _profile_id
      AND (c.creator_test_tenant IS TRUE OR c.is_sandbox IS TRUE)
  );
$$;

CREATE OR REPLACE FUNCTION public.safe_assign_crew(p_truck_id uuid, p_active_date date, p_member1_id uuid DEFAULT NULL::uuid, p_member2_id uuid DEFAULT NULL::uuid, p_member3_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid; v_existing_crew record; v_member_name text; v_member_ids uuid[]; v_mid uuid; v_user_id uuid;
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
  FOREACH v_mid IN ARRAY v_member_ids LOOP
    IF public.sandbox_cert_bypass(v_mid, v_company_id) THEN CONTINUE; END IF;
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = v_mid;
    IF v_user_id IS NULL OR NOT public.crew_assignable(v_user_id) THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License). Approve or verify on the Employees → Certifications page.',
          COALESCE(v_member_name, 'Employee')));
    END IF;
  END LOOP;
  FOREACH v_mid IN ARRAY v_member_ids LOOP
    SELECT c.id, t.name INTO v_existing_crew FROM public.crews c JOIN public.trucks t ON t.id = c.truck_id
    WHERE c.active_date = p_active_date AND c.truck_id != p_truck_id AND c.company_id = v_company_id
      AND (c.member1_id = v_mid OR c.member2_id = v_mid OR c.member3_id = v_mid) LIMIT 1;
    IF FOUND THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error', format('%s is already assigned to %s on this date', v_member_name, v_existing_crew.name));
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.crews WHERE truck_id = p_truck_id AND active_date = p_active_date AND company_id = v_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crew already assigned to this truck on this date');
  END IF;
  INSERT INTO public.crews (truck_id, member1_id, member2_id, member3_id, active_date, company_id)
  VALUES (p_truck_id, p_member1_id, p_member2_id, p_member3_id, p_active_date, v_company_id);
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.safe_assign_crew(p_truck_id uuid, p_active_date date, p_member1_id uuid, p_member2_id uuid, p_member3_id uuid, p_member3_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_company_id uuid; v_existing_crew record; v_member_name text; v_member_ids uuid[]; v_mid uuid; v_user_id uuid;
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
  FOREACH v_mid IN ARRAY ARRAY[p_member1_id, p_member2_id] LOOP
    IF v_mid IS NULL THEN CONTINUE; END IF;
    IF public.sandbox_cert_bypass(v_mid, v_company_id) THEN CONTINUE; END IF;
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = v_mid;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, 'primary') THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License). Approve or verify on the Employees → Certifications page.',
          COALESCE(v_member_name, 'Employee')));
    END IF;
  END LOOP;
  IF p_member3_id IS NOT NULL AND NOT public.sandbox_cert_bypass(p_member3_id, v_company_id) THEN
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_member3_id;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, p_member3_role) THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = p_member3_id;
      RETURN jsonb_build_object('ok', false, 'error',
        format('%s cannot be assigned as %s — missing or expired certifications (requires %s).',
          COALESCE(v_member_name, 'Employee'), p_member3_role, public.crew_role_cert_requirement(p_member3_role)));
    END IF;
  END IF;
  FOREACH v_mid IN ARRAY v_member_ids LOOP
    SELECT c.id, t.name INTO v_existing_crew FROM public.crews c JOIN public.trucks t ON t.id = c.truck_id
    WHERE c.active_date = p_active_date AND c.truck_id != p_truck_id AND c.company_id = v_company_id
      AND (c.member1_id = v_mid OR c.member2_id = v_mid OR c.member3_id = v_mid) LIMIT 1;
    IF FOUND THEN
      SELECT full_name INTO v_member_name FROM public.profiles WHERE id = v_mid;
      RETURN jsonb_build_object('ok', false, 'error', format('%s is already assigned to %s on this date', v_member_name, v_existing_crew.name));
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.crews WHERE truck_id = p_truck_id AND active_date = p_active_date AND company_id = v_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crew already assigned to this truck on this date');
  END IF;
  INSERT INTO public.crews (truck_id, member1_id, member2_id, member3_id, member3_role, active_date, company_id)
  VALUES (p_truck_id, p_member1_id, p_member2_id, p_member3_id, p_member3_role, p_active_date, v_company_id);
  RETURN jsonb_build_object('ok', true);
END;
$function$;