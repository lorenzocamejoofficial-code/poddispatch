CREATE TABLE public.crew_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_m double precision,
  speed_mps double precision,
  heading double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.crew_locations TO authenticated;
GRANT ALL ON public.crew_locations TO service_role;

ALTER TABLE public.crew_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can insert their own location pings"
ON public.crew_locations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND company_id = public.get_my_company_id());

CREATE POLICY "Users can view their own location pings"
ON public.crew_locations FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Dispatch roles can view company location pings"
ON public.crew_locations FOR SELECT TO authenticated
USING (
  company_id = public.get_my_company_id()
  AND public.get_my_role() IN ('owner', 'manager', 'dispatcher', 'creator')
);

CREATE POLICY "System creators can view all location pings"
ON public.crew_locations FOR SELECT TO authenticated
USING (public.is_system_creator());

CREATE INDEX idx_crew_locations_company_recorded
  ON public.crew_locations (company_id, recorded_at DESC);
CREATE INDEX idx_crew_locations_user_recorded
  ON public.crew_locations (user_id, recorded_at DESC);
CREATE INDEX idx_crew_locations_truck_recorded
  ON public.crew_locations (truck_id, recorded_at DESC);

ALTER TABLE public.crew_locations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_locations;

CREATE OR REPLACE FUNCTION public.purge_old_crew_locations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.crew_locations
  WHERE recorded_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;