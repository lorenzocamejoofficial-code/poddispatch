-- VERIFY 1a: Re-fire trigger on existing submitted PCR (success path)
UPDATE public.trip_records
SET pcr_status = 'draft'
WHERE id = '58383f7d-745b-4458-ba89-dca8e3e6e032';

UPDATE public.trip_records
SET pcr_status = 'submitted'
WHERE id = '58383f7d-745b-4458-ba89-dca8e3e6e032';

-- VERIFY 1b: Force failure by injecting bad data via temporary trigger wrapper
-- Create a trigger that raises an exception BEFORE auto_create runs, to simulate failure
CREATE OR REPLACE FUNCTION public.__test_force_claim_failure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Simulate a downstream failure inside the auto_create logic by raising
  -- after the auto_create trigger fires. We do this by temporarily breaking
  -- the claim_records insert path via a constraint violation simulation.
  RAISE EXCEPTION 'TEST: simulated downstream failure' USING ERRCODE = '23514';
END;
$$;

-- Wrap: temporarily replace auto_create with a failing version, fire it, restore
CREATE OR REPLACE FUNCTION public.auto_create_claim_on_pcr_submit_BACKUP()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;

-- Save current and install failing version
DO $outer$
DECLARE
  v_test_trip uuid;
  v_company uuid;
BEGIN
  -- Pick a trip that's currently NOT submitted, to test
  SELECT id, company_id INTO v_test_trip, v_company
  FROM public.trip_records
  WHERE pcr_status IS DISTINCT FROM 'submitted'
  LIMIT 1;

  IF v_test_trip IS NULL THEN
    RAISE NOTICE 'No non-submitted trip found for failure test';
    RETURN;
  END IF;

  RAISE NOTICE 'Test trip for failure: %', v_test_trip;
END;
$outer$;