-- Extend billing_overrides with canonical columns used by override workflow/logging
ALTER TABLE public.billing_overrides
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS snapshot JSONB,
  ADD COLUMN IF NOT EXISTS previous_blockers TEXT[];

-- Backfill canonical columns from legacy columns
UPDATE public.billing_overrides
SET
  user_id = COALESCE(user_id, overridden_by),
  reason = COALESCE(reason, override_reason),
  created_at = COALESCE(created_at, overridden_at),
  snapshot = COALESCE(snapshot, previous_blockers_snapshot),
  previous_blockers = COALESCE(
    previous_blockers,
    CASE
      WHEN previous_blockers_snapshot IS NULL THEN NULL
      WHEN jsonb_typeof(previous_blockers_snapshot) = 'object' AND previous_blockers_snapshot ? 'blockers'
        THEN ARRAY(SELECT jsonb_array_elements_text(previous_blockers_snapshot->'blockers'))
      WHEN jsonb_typeof(previous_blockers_snapshot) = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(previous_blockers_snapshot))
      ELSE NULL
    END
  )
WHERE user_id IS NULL
   OR reason IS NULL
   OR snapshot IS NULL
   OR previous_blockers IS NULL;

CREATE INDEX IF NOT EXISTS idx_billing_overrides_trip_active_created
  ON public.billing_overrides (trip_id, is_active, created_at DESC);

-- Transactional override function: insert override + update trip + insert audit log
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
  v_updated_trip public.trip_records%ROWTYPE;
  v_override public.billing_overrides%ROWTYPE;
  v_snapshot JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_trip_id IS NULL THEN
    RAISE EXCEPTION 'trip_id is required';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'override reason is required';
  END IF;

  IF NOT (public.is_billing() OR public.is_admin() OR public.is_system_creator()) THEN
    RAISE EXCEPTION 'Insufficient permissions for billing override';
  END IF;

  SELECT *
  INTO v_trip
  FROM public.trip_records
  WHERE id = p_trip_id
    AND company_id = public.get_my_company_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found or not accessible';
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
    'trip', to_jsonb(v_updated_trip),
    'override', to_jsonb(v_override)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_billing_override(UUID, TEXT) TO authenticated;