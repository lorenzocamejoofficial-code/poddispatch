CREATE OR REPLACE FUNCTION public.apply_billing_override(
  p_trip_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_records%ROWTYPE;
  v_trip_by_id public.trip_records%ROWTYPE;
  v_updated_trip public.trip_records%ROWTYPE;
  v_override public.billing_overrides%ROWTYPE;
  v_snapshot JSONB;
  v_company_id UUID;
  v_latest_simulation_run_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'AUTH_REQUIRED',
      'message', 'Authentication required'
    );
  END IF;

  IF p_trip_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'TRIP_ID_REQUIRED',
      'message', 'Trip id is required'
    );
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'REASON_REQUIRED',
      'message', 'Override reason is required'
    );
  END IF;

  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'PERMISSION_DENIED',
      'message', 'Insufficient permissions for billing override'
    );
  END IF;

  v_company_id := public.get_my_company_id();

  SELECT *
  INTO v_trip_by_id
  FROM public.trip_records
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'TRIP_NOT_FOUND',
      'message', 'Trip does not exist'
    );
  END IF;

  IF v_trip_by_id.company_id IS DISTINCT FROM v_company_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'TRIP_SCOPE_DENIED',
      'message', 'Trip exists but is outside your company scope'
    );
  END IF;

  SELECT *
  INTO v_trip
  FROM public.trip_records
  WHERE id = p_trip_id
    AND company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error_code', 'TRIP_SCOPE_DENIED',
      'message', 'Trip exists but is not accessible in your current scope'
    );
  END IF;

  IF v_trip.simulation_run_id IS NOT NULL THEN
    SELECT id
    INTO v_latest_simulation_run_id
    FROM public.simulation_runs
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_latest_simulation_run_id IS NOT NULL
       AND v_trip.simulation_run_id <> v_latest_simulation_run_id THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error_code', 'SIMULATION_RUN_MISMATCH',
        'message', 'Trip belongs to a stale simulation run; refresh Billing & Claims and try again',
        'trip_simulation_run_id', v_trip.simulation_run_id,
        'current_simulation_run_id', v_latest_simulation_run_id
      );
    END IF;
  END IF;

  v_snapshot := jsonb_build_object(
    'status', v_trip.status,
    'claim_ready', v_trip.claim_ready,
    'billing_blocked_reason', v_trip.billing_blocked_reason,
    'blockers', COALESCE(to_jsonb(v_trip.blockers), '[]'::jsonb)
  );

  INSERT INTO public.billing_overrides (
    trip_id,
    override_reason,
    overridden_by,
    overridden_at,
    previous_blockers_snapshot,
    user_id,
    reason,
    created_at,
    is_active,
    snapshot,
    previous_blockers
  )
  VALUES (
    p_trip_id,
    btrim(p_reason),
    auth.uid(),
    now(),
    v_snapshot,
    auth.uid(),
    btrim(p_reason),
    now(),
    true,
    v_snapshot,
    COALESCE(v_trip.blockers, '{}'::text[])
  )
  RETURNING * INTO v_override;

  UPDATE public.trip_records
  SET
    claim_ready = true,
    status = 'ready_for_billing',
    billing_blocked_reason = NULL,
    blockers = '{}'::text[],
    updated_at = now()
  WHERE id = p_trip_id
  RETURNING * INTO v_updated_trip;

  INSERT INTO public.audit_logs (
    action,
    actor_user_id,
    table_name,
    record_id,
    notes,
    old_data,
    new_data
  )
  VALUES (
    'billing_override',
    auth.uid(),
    'trip_records',
    p_trip_id,
    btrim(p_reason),
    v_snapshot,
    jsonb_build_object(
      'status', v_updated_trip.status,
      'claim_ready', v_updated_trip.claim_ready,
      'blockers', COALESCE(to_jsonb(v_updated_trip.blockers), '[]'::jsonb),
      'override_id', v_override.id
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'trip', to_jsonb(v_updated_trip),
    'override', to_jsonb(v_override)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_billing_override(UUID, TEXT) TO authenticated;