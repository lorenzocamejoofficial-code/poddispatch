CREATE TABLE public.geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  address_hash text NOT NULL,
  lat double precision,
  lng double precision,
  status text NOT NULL CHECK (status IN ('matched','no_match','error')),
  source text NOT NULL DEFAULT 'census',
  match_quality text,
  attempts integer NOT NULL DEFAULT 1,
  geocoded_at timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz,
  UNIQUE (company_id, address_hash)
);
COMMENT ON TABLE public.geocode_cache IS 'Facility-address geocode cache. Keyed by HMAC(company|normalized address); raw addresses are never stored. Written only by the geocode-facilities edge function.';
GRANT SELECT ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read own geocode cache"
  ON public.geocode_cache FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());