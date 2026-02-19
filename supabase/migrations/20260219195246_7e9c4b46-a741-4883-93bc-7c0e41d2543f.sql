
-- ─────────────────────────────────────────────────────────────────────────────
-- truck_builder_templates
--
-- Stores the "Default Truck Builder Template" for a company + day_type.
-- day_type: 'MWF' | 'TTS' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
--
-- mapping is a JSONB array of rule objects, each with shape:
--   { truck_id: uuid, transport_types: string[], leg_types: string[] }
--   e.g. [{ "truck_id": "...", "transport_types": ["dialysis"], "leg_types": ["A", "B"] }]
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.truck_builder_templates (
  id           uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   uuid NOT NULL,
  day_type     text NOT NULL,
  name         text NOT NULL DEFAULT 'Default Setup',
  mapping      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- one template per company + day_type
  UNIQUE (company_id, day_type)
);

-- Auto-update updated_at
CREATE TRIGGER truck_builder_templates_updated_at
  BEFORE UPDATE ON public.truck_builder_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.truck_builder_templates ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage templates scoped to their company
CREATE POLICY "Admins manage truck_builder_templates"
  ON public.truck_builder_templates
  FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- All company members can read templates (e.g. to show template info)
CREATE POLICY "Company members read templates"
  ON public.truck_builder_templates
  FOR SELECT
  USING (company_id = get_my_company_id());
