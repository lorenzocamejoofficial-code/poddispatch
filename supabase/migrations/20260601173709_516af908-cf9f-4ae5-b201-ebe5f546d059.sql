-- Pass-2 follow-up: dialysis return-leg (origin = dialysis) modifier backfill.
-- Mirror of the destination-side backfill from 20260531181945.
-- Flips the FIRST letter of the O/D location pair from any [DEGHIJNPRSX]
-- to 'J' when origin_type is dialysis. Submitted claims untouched.
UPDATE public.claim_records
SET hcpcs_modifiers = ARRAY(
  SELECT CASE
           WHEN m ~ '^[DEGHIJNPRSX]{2}$' THEN 'J' || substring(m, 2, 1)
           ELSE m
         END
    FROM unnest(hcpcs_modifiers) m
),
updated_at = now()
WHERE submitted_at IS NULL
  AND status <> 'submitted'::public.claim_status
  AND LOWER(COALESCE(origin_type, '')) LIKE '%dialysis%'
  AND EXISTS (
    SELECT 1 FROM unnest(hcpcs_modifiers) m WHERE m ~ '^[DEGHIJNPRSX]{2}$'
  );