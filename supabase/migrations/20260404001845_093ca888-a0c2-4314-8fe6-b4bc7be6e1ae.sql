
CREATE TABLE public.creator_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.creator_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creators can read creator_settings"
  ON public.creator_settings FOR SELECT
  TO authenticated
  USING (public.is_system_creator());

CREATE POLICY "System creators can insert creator_settings"
  ON public.creator_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators can update creator_settings"
  ON public.creator_settings FOR UPDATE
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

INSERT INTO public.creator_settings (key, value) VALUES ('cac_per_customer', '0');
