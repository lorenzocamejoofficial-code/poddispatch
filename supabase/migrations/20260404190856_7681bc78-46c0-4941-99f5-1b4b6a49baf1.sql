
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_path TEXT,
  trying_to_do TEXT,
  what_happened TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert tickets for their own company
CREATE POLICY "Users can insert tickets for own company"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND user_id = auth.uid()
  );

-- Owners can read all tickets for their company
CREATE POLICY "Owners can read company tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_my_company_id()
    AND public.is_admin()
  );
