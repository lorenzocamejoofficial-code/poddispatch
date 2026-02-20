
-- Migration settings per company
CREATE TABLE public.migration_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  parallel_mode boolean NOT NULL DEFAULT false,
  start_forward_mode boolean NOT NULL DEFAULT true,
  wizard_completed boolean NOT NULL DEFAULT false,
  wizard_step integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.migration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage migration_settings"
  ON public.migration_settings FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- Import sessions
CREATE TABLE public.import_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  file_name text NOT NULL,
  data_type text NOT NULL DEFAULT 'patients',
  status text NOT NULL DEFAULT 'pending',
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  warnings jsonb DEFAULT '[]'::jsonb,
  column_mapping jsonb DEFAULT '{}'::jsonb,
  raw_headers text[] DEFAULT '{}',
  is_historical boolean NOT NULL DEFAULT false,
  is_test_mode boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import_sessions"
  ON public.import_sessions FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- Saved mapping templates
CREATE TABLE public.import_mapping_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  data_type text NOT NULL DEFAULT 'patients',
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_mapping_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import_mapping_templates"
  ON public.import_mapping_templates FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- Triggers for updated_at
CREATE TRIGGER update_migration_settings_updated_at
  BEFORE UPDATE ON public.migration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_sessions_updated_at
  BEFORE UPDATE ON public.import_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
