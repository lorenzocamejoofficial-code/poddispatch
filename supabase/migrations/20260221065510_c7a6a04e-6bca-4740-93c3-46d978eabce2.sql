
-- System creators table (super-admin level, not company-scoped)
CREATE TABLE public.system_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_creators ENABLE ROW LEVEL SECURITY;

-- Security definer function to check system creator status
CREATE OR REPLACE FUNCTION public.is_system_creator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_creators WHERE user_id = auth.uid()
  )
$$;

-- Only system creators can read the table
CREATE POLICY "System creators read own"
ON public.system_creators
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Per-company session timeout settings
ALTER TABLE public.company_settings
ADD COLUMN session_timeout_minutes integer NOT NULL DEFAULT 30,
ADD COLUMN session_warning_enabled boolean NOT NULL DEFAULT true;
