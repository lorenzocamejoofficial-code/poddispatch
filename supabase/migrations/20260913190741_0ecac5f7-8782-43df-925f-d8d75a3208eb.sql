CREATE OR REPLACE FUNCTION public.enforce_truck_plan_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_is_founding boolean;
  v_is_test boolean;
  v_count integer;
BEGIN
  IF COALESCE(NEW.is_simulated, false) THEN RETURN NEW; END IF;

  SELECT (COALESCE(creator_test_tenant, false) OR COALESCE(is_sandbox, false))
    INTO v_is_test
    FROM public.companies WHERE id = NEW.company_id;
  IF COALESCE(v_is_test, false) THEN RETURN NEW; END IF;

  SELECT plan_id, COALESCE(is_founding, false)
    INTO v_plan, v_is_founding
    FROM public.subscription_records
    WHERE company_id = NEW.company_id
    LIMIT 1;

  -- Founding (by flag or by plan name) and Pro = unlimited
  IF v_is_founding OR v_plan IN ('pro', 'founding') THEN RETURN NEW; END IF;

  -- Starter, trial, or unknown/null = 5-truck cap
  SELECT count(*) INTO v_count
    FROM public.trucks
    WHERE company_id = NEW.company_id
      AND COALESCE(is_simulated, false) = false;
  IF v_count >= 5 THEN
    RAISE EXCEPTION 'TRUCK_CAP_EXCEEDED: Starter plan includes up to 5 trucks. Upgrade to Pro to add more.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;