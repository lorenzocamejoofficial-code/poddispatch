
-- Create truck availability table for date-range maintenance/outage tracking
CREATE TABLE public.truck_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id),
  status text NOT NULL DEFAULT 'down_maintenance' CHECK (status IN ('down_maintenance', 'down_out_of_service')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.truck_availability ENABLE ROW LEVEL SECURITY;

-- Admins can manage all availability records for their company
CREATE POLICY "Admins manage truck_availability"
  ON public.truck_availability
  FOR ALL
  USING (is_admin() AND (company_id = get_my_company_id()));

-- Crew can read availability for their company
CREATE POLICY "Crew read truck_availability"
  ON public.truck_availability
  FOR SELECT
  USING (company_id = get_my_company_id());

-- Index for fast date-range lookups
CREATE INDEX idx_truck_availability_truck_date 
  ON public.truck_availability (truck_id, start_date, end_date);

CREATE INDEX idx_truck_availability_company 
  ON public.truck_availability (company_id);
