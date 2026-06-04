
-- 1. is_founding flag
ALTER TABLE public.subscription_records
  ADD COLUMN IF NOT EXISTS is_founding boolean NOT NULL DEFAULT false;

-- 2. Founding counter (single row, id=1)
CREATE TABLE IF NOT EXISTS public.founding_counter (
  id smallint PRIMARY KEY DEFAULT 1,
  paid_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founding_counter_singleton CHECK (id = 1)
);

GRANT SELECT ON public.founding_counter TO authenticated;
GRANT ALL ON public.founding_counter TO service_role;

ALTER TABLE public.founding_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read founding counter"
  ON public.founding_counter FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.founding_counter (id, paid_count)
  VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING;

-- 3. Atomic claim function: reserves a founding slot if available.
-- Returns true if the caller got a founding slot, false otherwise.
CREATE OR REPLACE FUNCTION public.try_claim_founding_slot()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT paid_count INTO v_count
    FROM public.founding_counter
    WHERE id = 1
    FOR UPDATE;

  IF v_count < 5 THEN
    UPDATE public.founding_counter
       SET paid_count = paid_count + 1,
           updated_at = now()
     WHERE id = 1;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.try_claim_founding_slot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_claim_founding_slot() TO service_role;

-- 4. Truck cap trigger: Starter plan limited to 5 active trucks.
-- Founding and Pro have no cap. Sandbox / creator test tenants bypass.
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

  -- Founding + Pro = unlimited (up to global system cap enforced elsewhere)
  IF v_is_founding OR v_plan = 'pro' THEN RETURN NEW; END IF;

  -- Starter (or unknown/trial) = 5-truck cap
  IF v_plan IN ('starter', 'trial') OR v_plan IS NULL THEN
    SELECT count(*) INTO v_count
      FROM public.trucks
      WHERE company_id = NEW.company_id
        AND COALESCE(is_simulated, false) = false;
    IF v_count >= 5 THEN
      RAISE EXCEPTION 'TRUCK_CAP_EXCEEDED: Starter plan includes up to 5 trucks. Upgrade to Pro to add more.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_truck_plan_cap_trg ON public.trucks;
CREATE TRIGGER enforce_truck_plan_cap_trg
  BEFORE INSERT ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_truck_plan_cap();
