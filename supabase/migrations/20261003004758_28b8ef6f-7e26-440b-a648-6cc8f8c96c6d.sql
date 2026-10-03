CREATE TABLE public.nemsis_cta_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('QueryLimit','SubmitData','RetrieveStatus')),
  data_schema INTEGER,
  schema_version TEXT,
  request_xml_redacted TEXT,
  response_xml TEXT,
  http_status INTEGER,
  status_code INTEGER,
  status_label TEXT,
  request_handle TEXT,
  limit_value INTEGER,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nemsis_cta_submissions TO authenticated;
GRANT ALL ON public.nemsis_cta_submissions TO service_role;
ALTER TABLE public.nemsis_cta_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System creators can view CTA submissions"
ON public.nemsis_cta_submissions FOR SELECT TO authenticated
USING (public.is_system_creator());
CREATE INDEX nemsis_cta_submissions_created_idx ON public.nemsis_cta_submissions(created_at DESC);