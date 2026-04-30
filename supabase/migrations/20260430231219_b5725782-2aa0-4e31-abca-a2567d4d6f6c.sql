
-- Queue table for 837P claim files awaiting SFTP submission
CREATE TABLE public.claim_submission_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  claim_ids uuid[] NOT NULL DEFAULT '{}',
  filename text NOT NULL,
  edi_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'submitted', 'failed')),
  is_test boolean NOT NULL DEFAULT false,
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for worker polling
CREATE INDEX idx_csq_status ON public.claim_submission_queue (status) WHERE status IN ('pending', 'failed');

-- RLS
ALTER TABLE public.claim_submission_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company queue" ON public.claim_submission_queue
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Billers can insert queue items" ON public.claim_submission_queue
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_my_company_id() AND (public.is_billing() OR public.is_admin()));

-- Service role (Railway worker) will use service_role key to update status — no RLS needed for that
