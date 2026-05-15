ALTER TABLE public.claim_submission_queue
  ADD COLUMN IF NOT EXISTS oatest_run_id uuid REFERENCES public.oatest_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_csq_oatest_run ON public.claim_submission_queue(oatest_run_id) WHERE oatest_run_id IS NOT NULL;

-- Allow system creators to insert OATEST-tagged queue rows on behalf of the
-- Lorenzo Test Company (the merged Sim Lab / OATEST runner uses the service
-- role, but this policy keeps creator-side direct inserts possible).
DROP POLICY IF EXISTS "Creators can insert OATEST queue items" ON public.claim_submission_queue;
CREATE POLICY "Creators can insert OATEST queue items"
  ON public.claim_submission_queue
  FOR INSERT
  TO authenticated
  WITH CHECK (oatest_run_id IS NOT NULL AND is_system_creator());