
-- Migration 2: remittance_files table
CREATE TABLE public.remittance_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  file_name text NOT NULL,
  file_content text NOT NULL,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id),
  claims_matched integer NOT NULL DEFAULT 0,
  claims_updated integer NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'
);

ALTER TABLE public.remittance_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and billing read remittance_files"
  ON public.remittance_files FOR SELECT
  TO authenticated
  USING (
    (is_admin() OR is_billing()) AND company_id = get_my_company_id()
  );

CREATE POLICY "Owner and billing insert remittance_files"
  ON public.remittance_files FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_admin() OR is_billing()) AND company_id = get_my_company_id()
  );

CREATE POLICY "System creator read remittance_files"
  ON public.remittance_files FOR SELECT
  TO authenticated
  USING (is_system_creator());
