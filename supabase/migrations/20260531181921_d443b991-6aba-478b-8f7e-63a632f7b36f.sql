CREATE OR REPLACE FUNCTION public.retry_claim_creation(p_trip_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_trip public.trip_records%ROWTYPE;
  v_resolved_by uuid;
BEGIN
  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;

  v_company_id := public.get_my_company_id();

  SELECT id INTO v_resolved_by
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT * INTO v_trip
  FROM public.trip_records
  WHERE id = p_trip_id
    AND company_id = v_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TRIP_NOT_FOUND');
  END IF;

  IF v_trip.pcr_status IS DISTINCT FROM 'submitted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PCR_NOT_SUBMITTED');
  END IF;

  UPDATE public.trip_records SET pcr_status = 'draft' WHERE id = p_trip_id;
  UPDATE public.trip_records SET pcr_status = 'submitted' WHERE id = p_trip_id;

  UPDATE public.claim_creation_failures
  SET resolved_at = now(), resolved_by = v_resolved_by
  WHERE trip_id = p_trip_id
    AND company_id = v_company_id
    AND resolved_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_claim_creation_failure(p_failure_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_resolved_by uuid;
BEGIN
  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PERMISSION_DENIED');
  END IF;

  v_company_id := public.get_my_company_id();

  SELECT id INTO v_resolved_by
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  UPDATE public.claim_creation_failures
  SET resolved_at = now(), resolved_by = v_resolved_by
  WHERE id = p_failure_id
    AND company_id = v_company_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;