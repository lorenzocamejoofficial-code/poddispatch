-- 1. Add column (nullable, so we can backfill before the NOT NULL constraint).
ALTER TABLE public.payer_directory
  ADD COLUMN IF NOT EXISTS claim_filing_indicator TEXT;

COMMENT ON COLUMN public.payer_directory.claim_filing_indicator IS
  'X12 005010X222A1 SBR09 claim filing indicator code. Sourced from CMS Pub 100-04 claim filing indicator code list. Must NOT be derived from payer_type — set explicitly per payer based on the underlying coverage type, even for managed care plans.';

-- 2. Backfill the four seeded GA payers by oa_payer_id (verified by SELECT in audit).
UPDATE public.payer_directory SET claim_filing_indicator = 'MB' WHERE oa_payer_id = '10202';
UPDATE public.payer_directory SET claim_filing_indicator = 'MC' WHERE oa_payer_id = '77034';
UPDATE public.payer_directory SET claim_filing_indicator = 'MC' WHERE oa_payer_id = '26375';
UPDATE public.payer_directory SET claim_filing_indicator = 'MC' WHERE oa_payer_id = '68069';

-- Safety net: any other existing rows without an explicit value get 'ZZ' (Mutually
-- Defined) — surfaces them to billers as obviously-wrong so they can be corrected
-- via the directory UI. ZZ should never make it into a real submission; the
-- generator's hardened guard treats it as a last-resort fallback only.
UPDATE public.payer_directory SET claim_filing_indicator = 'ZZ' WHERE claim_filing_indicator IS NULL;

-- 3. Enforce NOT NULL + CHECK going forward.
ALTER TABLE public.payer_directory
  ALTER COLUMN claim_filing_indicator SET NOT NULL;

ALTER TABLE public.payer_directory
  ADD CONSTRAINT payer_directory_claim_filing_indicator_chk
  CHECK (claim_filing_indicator IN (
    'MB',  -- Medicare Part B
    'MA',  -- Medicare Part A
    'MC',  -- Medicaid (including managed Medicaid)
    'CI',  -- Commercial Insurance
    '16',  -- HMO Medicare Risk / Medicare Advantage
    'BL',  -- Blue Cross/Blue Shield
    'HM',  -- Health Maintenance Organization
    'WC',  -- Workers Compensation
    'AM',  -- Automobile Medical
    'CH',  -- Champus/Tricare
    'VA',  -- Veterans Affairs
    'ZZ'   -- Mutually Defined (fallback only, should never be emitted in practice)
  ));