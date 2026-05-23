
-- Audit Exports: tamper-evident, immutable export records for legal/regulatory production
CREATE TABLE public.audit_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  regime text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  include_test_data boolean NOT NULL DEFAULT false,
  generated_by uuid NOT NULL,
  generated_by_email text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  file_path text NOT NULL,
  file_size_bytes bigint,
  sha256 text NOT NULL,
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_sealed boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_audit_exports_company_date ON public.audit_exports (company_id, generated_at DESC);

ALTER TABLE public.audit_exports ENABLE ROW LEVEL SECURITY;

-- Read: owners/creators/managers within their company; system creators see all
CREATE POLICY "Owners read company audit exports"
  ON public.audit_exports FOR SELECT
  USING (
    public.is_system_creator()
    OR (company_id = public.get_my_company_id() AND public.is_owner_or_creator())
    OR (company_id = public.get_my_company_id() AND public.is_admin())
  );

-- Insert: only the edge function service role writes here (no client insert policy)
-- Explicitly: NO update or delete policy = immutable from clients

-- Storage bucket for sealed export zips (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-exports', 'audit-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Owners can read their own company's export files (path convention: <company_id>/<export_id>.zip)
CREATE POLICY "Owners read own audit export files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audit-exports'
    AND (
      public.is_system_creator()
      OR (
        (storage.foldername(name))[1] = public.get_my_company_id()::text
        AND (public.is_owner_or_creator() OR public.is_admin())
      )
    )
  );
