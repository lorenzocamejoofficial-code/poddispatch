
-- Create crew_share_tokens for shareable daily run sheet links
CREATE TABLE public.crew_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '2 days')::date,
  created_by UUID NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crew_share_tokens ENABLE ROW LEVEL SECURITY;

-- Admins manage tokens
CREATE POLICY "Admins manage share tokens"
  ON public.crew_share_tokens FOR ALL
  USING (is_admin());

-- Public read by token (for unauthenticated share link access)
CREATE POLICY "Public read active tokens"
  ON public.crew_share_tokens FOR SELECT
  USING (active = true AND CURRENT_DATE BETWEEN valid_from AND valid_until);
