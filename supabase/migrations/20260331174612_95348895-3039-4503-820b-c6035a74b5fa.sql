
-- 1. Incident Reports table
CREATE TABLE public.incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  submitted_by UUID NOT NULL,
  truck_id UUID REFERENCES public.trucks(id),
  patient_id UUID REFERENCES public.patients(id),
  incident_date TIMESTAMP WITH TIME ZONE NOT NULL,
  incident_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  emergency_services_contacted BOOLEAN NOT NULL DEFAULT false,
  crew_names TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage incident_reports" ON public.incident_reports
  FOR ALL TO authenticated
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

CREATE POLICY "Dispatchers read incident_reports" ON public.incident_reports
  FOR SELECT TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id());

CREATE POLICY "Crew insert incident_reports" ON public.incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Crew read own incident_reports" ON public.incident_reports
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() AND submitted_by = auth.uid());

-- 2. Claim Adjustments table
CREATE TABLE public.claim_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL,
  company_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read claim_adjustments" ON public.claim_adjustments
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Billing insert claim_adjustments" ON public.claim_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id() AND (is_billing() OR is_admin()));

CREATE POLICY "System creator read claim_adjustments" ON public.claim_adjustments
  FOR SELECT TO authenticated
  USING (is_system_creator());

-- 3. Data retention policy on company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS retention_policy_years INTEGER NOT NULL DEFAULT 7;

-- 4. Storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage RLS: company members can upload
CREATE POLICY "Authenticated users upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users read documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Admins delete documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (SELECT is_admin()));

-- 5. Document metadata table to track uploads
CREATE TABLE public.document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  record_type TEXT NOT NULL, -- 'patient', 'trip', 'pcr'
  record_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other', -- 'pcs', 'standing_order', 'dnr', 'signed_form', 'other'
  uploaded_by UUID NOT NULL,
  uploaded_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read document_attachments" ON public.document_attachments
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Authenticated insert document_attachments" ON public.document_attachments
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Admins delete document_attachments" ON public.document_attachments
  FOR DELETE TO authenticated
  USING (is_admin() AND company_id = get_my_company_id());
