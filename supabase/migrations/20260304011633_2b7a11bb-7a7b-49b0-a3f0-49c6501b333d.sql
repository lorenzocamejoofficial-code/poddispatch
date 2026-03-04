
-- Invites table for invite-only user onboarding
CREATE TABLE public.company_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'dispatcher',
  token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL,
  accepted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT valid_invite_role CHECK (role IN ('dispatcher', 'biller')),
  CONSTRAINT valid_invite_status CHECK (status IN ('pending', 'accepted', 'revoked')),
  UNIQUE(company_id, email, status)
);

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- Owners can manage invites for their company
CREATE POLICY "Owners manage company invites"
  ON public.company_invites FOR ALL
  USING (is_company_owner_or_creator(company_id))
  WITH CHECK (is_company_owner_or_creator(company_id));

-- Anyone can read invites by token (for accepting)
CREATE POLICY "Read invite by token"
  ON public.company_invites FOR SELECT
  USING (true);
