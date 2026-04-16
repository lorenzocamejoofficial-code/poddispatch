-- Add service_level to scheduling_legs so it cascades to downstream systems
ALTER TABLE public.scheduling_legs ADD COLUMN IF NOT EXISTS service_level text DEFAULT NULL;

-- Add is_unscheduled flag to scheduling_legs for scheduled vs same-day differentiation
ALTER TABLE public.scheduling_legs ADD COLUMN IF NOT EXISTS is_unscheduled boolean DEFAULT false;