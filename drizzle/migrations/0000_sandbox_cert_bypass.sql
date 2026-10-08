CREATE OR REPLACE FUNCTION public.sandbox_cert_bypass(_profile_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = _profile_id AND p.company_id = c.id
    WHERE c.id = _company_id
      AND (c.creator_test_tenant IS TRUE OR c.is_sandbox IS TRUE)
      AND p.email ILIKE '%test%'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_crew_cert_gate()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_name text;
  v_pid uuid;
BEGIN
  FOREACH v_pid IN ARRAY ARRAY[NEW.member1_id, NEW.member2_id] LOOP
    IF v_pid IS NULL THEN CONTINUE; END IF;
    IF public.sandbox_cert_bypass(v_pid, NEW.company_id) THEN CONTINUE; END IF;
    SELECT p.user_id, p.full_name INTO v_user_id, v_name FROM public.profiles p WHERE p.id = v_pid;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, 'primary') THEN
      RAISE EXCEPTION '% cannot be assigned — missing or expired certifications (Medic #, CPR, Driver''s License).',
        COALESCE(v_name, 'Employee');
    END IF;
  END LOOP;

  IF NEW.member3_id IS NOT NULL AND NOT public.sandbox_cert_bypass(NEW.member3_id, NEW.company_id) THEN
    SELECT p.user_id, p.full_name INTO v_user_id, v_name FROM public.profiles p WHERE p.id = NEW.member3_id;
    IF v_user_id IS NULL OR NOT public.crew_assignable_for_role(v_user_id, NEW.member3_role) THEN
      RAISE EXCEPTION '% cannot be assigned as % — missing or expired certifications (requires %).',
        COALESCE(v_name, 'Employee'), COALESCE(NEW.member3_role, 'crew'),
        public.crew_role_cert_requirement(NEW.member3_role);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;