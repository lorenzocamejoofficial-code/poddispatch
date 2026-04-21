-- Rate limit counter table for edge functions
CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  identifier text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS edge_function_rate_limits_fn_id_uniq
  ON public.edge_function_rate_limits (function_name, identifier);

CREATE INDEX IF NOT EXISTS edge_function_rate_limits_window_start_idx
  ON public.edge_function_rate_limits (window_start);

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

-- No client-side access; service role bypasses RLS. Deny-all for everyone else.
CREATE POLICY "no client access to rate limits"
  ON public.edge_function_rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);