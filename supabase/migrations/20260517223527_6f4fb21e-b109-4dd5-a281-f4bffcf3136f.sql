
DROP TABLE IF EXISTS public.cms_locality_gaf;

CREATE TABLE public.cms_ambulance_fee_schedule (
  carrier              text NOT NULL,
  locality             text NOT NULL,
  hcpcs                text NOT NULL,
  rvu                  numeric(6,2),
  gpci                 numeric(6,3),
  base_rate            numeric(10,2),
  urban_rate           numeric(10,2),
  rural_rate           numeric(10,2),
  rural_lowest_quartile_rate numeric(10,2),
  rural_miles_1_17_rate      numeric(10,2),
  effective_year       integer NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (carrier, locality, hcpcs, effective_year)
);

ALTER TABLE public.cms_ambulance_fee_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read AFS"
  ON public.cms_ambulance_fee_schedule FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System creators can manage AFS"
  ON public.cms_ambulance_fee_schedule FOR ALL
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());
