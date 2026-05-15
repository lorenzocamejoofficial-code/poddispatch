-- Ensure system creators can enter the Lorenzo Test Company simulation tenant consistently.
INSERT INTO public.company_memberships (company_id, user_id, role)
SELECT 'f53311c3-a40e-4b2b-b4c2-5aec852f7789'::uuid, sc.user_id, 'creator'::public.membership_role
FROM public.system_creators sc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_memberships cm
  WHERE cm.company_id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789'::uuid
    AND cm.user_id = sc.user_id
);

CREATE OR REPLACE FUNCTION public.enter_creator_simulation(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company public.companies%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_system_creator() THEN
    RAISE EXCEPTION 'Only system creators can enter simulation tenants';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = _company_id
    AND deleted_at IS NULL
    AND (creator_test_tenant = true OR is_sandbox = true);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulation tenant not available';
  END IF;

  INSERT INTO public.company_memberships (company_id, user_id, role)
  VALUES (_company_id, v_user_id, 'creator'::public.membership_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.profiles (user_id, full_name, email, active_company_id, company_id)
  VALUES (
    v_user_id,
    COALESCE((auth.jwt() ->> 'email'), 'System Creator'),
    auth.jwt() ->> 'email',
    _company_id,
    _company_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET active_company_id = EXCLUDED.active_company_id,
      company_id = COALESCE(public.profiles.company_id, EXCLUDED.company_id),
      email = COALESCE(public.profiles.email, EXCLUDED.email);

  RETURN _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enter_creator_simulation(uuid) TO authenticated;