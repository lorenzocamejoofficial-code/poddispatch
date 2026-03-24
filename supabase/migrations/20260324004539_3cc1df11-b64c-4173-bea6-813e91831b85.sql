
ALTER TABLE public.patients
  ADD COLUMN location_type text,
  ADD COLUMN facility_id uuid REFERENCES public.facilities(id) ON DELETE SET NULL;
