
-- 1. Structured CAS adjustments on claim_payments (for COB replay in 837P secondary)
ALTER TABLE public.claim_payments
  ADD COLUMN IF NOT EXISTS cas_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.claim_payments.cas_adjustments IS
  'Structured array of {group_code, reason_code, amount} parsed from primary 835 CAS segments. Used to emit Loop 2320 CAS segments when generating a secondary 837P claim.';

-- 2. Allow secondary claims on the same trip as the primary
DROP INDEX IF EXISTS public.claim_records_trip_id_uidx;
CREATE UNIQUE INDEX claim_records_primary_trip_uidx
  ON public.claim_records (trip_id)
  WHERE trip_id IS NOT NULL AND original_claim_id IS NULL;

-- 3. Seed test data: patient gets Medicaid secondary
UPDATE public.patients
SET secondary_payer = 'medicaid',
    secondary_member_id = 'GA987654321',
    secondary_payer_id = 'MEDICAID'
WHERE id = '5a0e412c-7d24-483a-82b5-5b2c1343a2a0'
  AND secondary_payer IS NULL;

-- 4. Seed a paid primary remittance on claim 27d70fe1 so the secondary path is exercisable.
--    Medicare typical: 80% paid, 20% PR-1 deductible/coinsurance, plus a small CO-45 contractual.
--    The recompute trigger flips claim_records.status to 'paid' once this insert lands.
INSERT INTO public.claim_payments (
  claim_record_id, company_id, event_type, clp_status_code, amount,
  patient_responsibility, write_off, allowed_amount, denial_code,
  adjustment_codes, cas_adjustments, payer_claim_control_number, payment_date
)
SELECT
  '27d70fe1-d67b-4480-9345-fc091eef7060'::uuid,
  'f53311c3-a40e-4b2b-b4c2-5aec852f7789'::uuid,
  'payment',
  '1',
  240.00,                  -- paid (sample, primary covered most of the 349.48 charge)
  69.90,                   -- PR (~20%)
  39.58,                   -- CO-45 contractual write-off
  309.90,                  -- allowed (charge - CO-45)
  NULL,
  ARRAY['CO-45','PR-1']::text[],
  '[{"group_code":"CO","reason_code":"45","amount":39.58},
    {"group_code":"PR","reason_code":"1","amount":69.90}]'::jsonb,
  'OACTRL27D70FE1',
  CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM public.claim_payments
  WHERE claim_record_id = '27d70fe1-d67b-4480-9345-fc091eef7060'::uuid
);
