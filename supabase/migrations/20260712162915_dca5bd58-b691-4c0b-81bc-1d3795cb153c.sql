CREATE TABLE public.nemsis_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trip_records(id) ON DELETE CASCADE,
  destination_state TEXT NOT NULL,
  endpoint_url TEXT,
  test_mode BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','submitting','accepted','rejected','error')),
  payload_xml TEXT,
  ack_xml TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX nemsis_submissions_company_status_idx ON public.nemsis_submissions(company_id, status);
CREATE INDEX nemsis_submissions_trip_idx ON public.nemsis_submissions(trip_id);
CREATE INDEX nemsis_submissions_retry_idx ON public.nemsis_submissions(status, retry_count) WHERE status IN ('queued','error');

GRANT SELECT ON public.nemsis_submissions TO authenticated;
GRANT ALL ON public.nemsis_submissions TO service_role;

ALTER TABLE public.nemsis_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company's NEMSIS submissions"
  ON public.nemsis_submissions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_memberships WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_nemsis_submissions_updated_at
  BEFORE UPDATE ON public.nemsis_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();