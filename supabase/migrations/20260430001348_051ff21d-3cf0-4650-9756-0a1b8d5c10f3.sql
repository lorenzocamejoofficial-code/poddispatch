-- Workstream 2: Office Ally test mode (OATEST) support
-- Adds opt-in sandbox flag + separate test submitter ID for the clearinghouse,
-- and tags claim records that were submitted as test so they can be filtered
-- out of real billing metrics.

ALTER TABLE public.clearinghouse_settings
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_submitter_id text;

COMMENT ON COLUMN public.clearinghouse_settings.test_mode IS
  'When true, eligibility/claims/remittance calls route to Office Ally OATEST sandbox endpoints and submitted claims are tagged is_test_submission=true. No real money moves.';
COMMENT ON COLUMN public.clearinghouse_settings.test_submitter_id IS
  'Office Ally OATEST submitter ID (separate from production submitter_id). Used only when test_mode=true.';

ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS is_test_submission boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.claim_records.is_test_submission IS
  'True when this claim was submitted while clearinghouse_settings.test_mode was on. Excluded from real AR/revenue metrics by default.';

-- Index so the Billing & Claims filter ("hide test submissions") stays fast.
CREATE INDEX IF NOT EXISTS idx_claim_records_test_submission
  ON public.claim_records (company_id, is_test_submission)
  WHERE is_test_submission = true;
