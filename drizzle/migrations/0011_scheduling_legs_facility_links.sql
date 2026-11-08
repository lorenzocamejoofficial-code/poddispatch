ALTER TABLE public.scheduling_legs
  ADD COLUMN pickup_facility_id uuid NULL REFERENCES public.facilities(id) ON DELETE SET NULL,
  ADD COLUMN destination_facility_id uuid NULL REFERENCES public.facilities(id) ON DELETE SET NULL;
CREATE INDEX idx_scheduling_legs_pickup_facility ON public.scheduling_legs (pickup_facility_id) WHERE pickup_facility_id IS NOT NULL;
CREATE INDEX idx_scheduling_legs_destination_facility ON public.scheduling_legs (destination_facility_id) WHERE destination_facility_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_leg_facility_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pickup_facility_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.facilities f WHERE f.id = NEW.pickup_facility_id AND f.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'pickup_facility_id must belong to the same company as the leg';
  END IF;
  IF NEW.destination_facility_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.facilities f WHERE f.id = NEW.destination_facility_id AND f.company_id = NEW.company_id) THEN
    RAISE EXCEPTION 'destination_facility_id must belong to the same company as the leg';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_leg_facility_company
BEFORE INSERT OR UPDATE OF pickup_facility_id, destination_facility_id, company_id ON public.scheduling_legs
FOR EACH ROW EXECUTE FUNCTION public.guard_leg_facility_company();