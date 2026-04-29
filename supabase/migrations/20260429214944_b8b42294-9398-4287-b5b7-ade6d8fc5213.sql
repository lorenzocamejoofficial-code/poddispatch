-- Enums
CREATE TYPE public.email_type AS ENUM (
  'password_reset',
  'signup_verification',
  'crew_invite',
  'crew_schedule',
  'other'
);

CREATE TYPE public.email_send_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'bounced',
  'suppressed'
);

-- Table
CREATE TABLE public.email_send_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  company_id UUID NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID NULL,
  email_type public.email_type NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL,
  from_address TEXT NOT NULL,
  from_name TEXT NULL,
  status public.email_send_status NOT NULL DEFAULT 'pending',
  resend_email_id TEXT NULL,
  error_message TEXT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_email_send_log_company_created ON public.email_send_log(company_id, created_at DESC);
CREATE INDEX idx_email_send_log_recipient ON public.email_send_log(recipient_email);
CREATE INDEX idx_email_send_log_status ON public.email_send_log(status);
CREATE INDEX idx_email_send_log_created_at ON public.email_send_log(created_at DESC);

-- RLS
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- System creators can view everything
CREATE POLICY "System creators can view all email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.is_system_creator());

-- Company owners/creators can view their company's logs
CREATE POLICY "Owners can view their company email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.is_company_owner_or_creator(company_id)
);

-- Only the service role writes to this table (no INSERT/UPDATE/DELETE policies for authenticated)
