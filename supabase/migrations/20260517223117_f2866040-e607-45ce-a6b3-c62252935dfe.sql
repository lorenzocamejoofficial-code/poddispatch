
-- 1. charge_master flags
ALTER TABLE public.charge_master
  ADD COLUMN IF NOT EXISTS auto_seeded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 2. CMS ZIP -> locality reference
CREATE TABLE IF NOT EXISTS public.cms_zip_locality (
  zip5            text PRIMARY KEY,
  state           text NOT NULL,
  carrier         text NOT NULL,
  locality        text NOT NULL,
  rural_flag      text NOT NULL CHECK (rural_flag IN ('U','R','B')),
  effective_year  integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cms_zip_locality_state ON public.cms_zip_locality(state);

ALTER TABLE public.cms_zip_locality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read CMS ZIP locality"
  ON public.cms_zip_locality FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System creators can manage CMS ZIP locality"
  ON public.cms_zip_locality FOR ALL
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

-- 3. CMS locality -> GAF (ambulance) reference
CREATE TABLE IF NOT EXISTS public.cms_locality_gaf (
  carrier         text NOT NULL,
  locality        text NOT NULL,
  gaf_ambulance   numeric(6,4) NOT NULL,
  effective_year  integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (carrier, locality, effective_year)
);

ALTER TABLE public.cms_locality_gaf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read CMS locality GAF"
  ON public.cms_locality_gaf FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System creators can manage CMS locality GAF"
  ON public.cms_locality_gaf FOR ALL
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());
