-- Add recovery fields to system_creators
ALTER TABLE public.system_creators
  ADD COLUMN IF NOT EXISTS recovery_slug_hash text,
  ADD COLUMN IF NOT EXISTS recovery_passphrase_hash text,
  ADD COLUMN IF NOT EXISTS recovery_configured_at timestamptz;

-- Track recovery attempts for rate-limiting + audit
CREATE TABLE IF NOT EXISTS public.creator_recovery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text,
  user_agent text,
  slug_provided_hash text, -- hash of the slug attempted (so we don't store plaintext)
  outcome text NOT NULL CHECK (outcome IN ('slug_invalid', 'passphrase_invalid', 'rate_limited', 'success', 'no_creator_configured', 'error')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_recovery_attempts_ip_time
  ON public.creator_recovery_attempts (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_recovery_attempts_created_at
  ON public.creator_recovery_attempts (created_at DESC);

-- Lock down both tables — only service role (edge functions) should touch these
ALTER TABLE public.creator_recovery_attempts ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated. Service role bypasses RLS by design.
-- system_creators already has RLS enabled from prior migrations; the new columns inherit existing policies.

COMMENT ON TABLE public.creator_recovery_attempts IS
  'Audit + rate-limit tracking for system creator recovery attempts. Service-role only.';
COMMENT ON COLUMN public.system_creators.recovery_slug_hash IS
  'SHA-256 hash of the secret URL slug used in /sys-r/<slug>. Plaintext slug never stored.';
COMMENT ON COLUMN public.system_creators.recovery_passphrase_hash IS
  'bcrypt hash of the recovery passphrase. Plaintext never stored.';