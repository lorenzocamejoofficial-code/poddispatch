
-- Onboarding status enum
CREATE TYPE public.onboarding_status AS ENUM (
  'signup_started',
  'agreements_accepted',
  'payment_pending',
  'payment_confirmed',
  'pending_approval',
  'active',
  'rejected',
  'suspended',
  'payment_issue'
);

-- Add onboarding columns to companies
ALTER TABLE public.companies
  ADD COLUMN onboarding_status public.onboarding_status NOT NULL DEFAULT 'active',
  ADD COLUMN owner_user_id uuid,
  ADD COLUMN owner_email text,
  ADD COLUMN suspended_reason text,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approved_by uuid,
  ADD COLUMN rejected_at timestamptz,
  ADD COLUMN rejected_reason text;

-- Legal agreement acceptances
CREATE TABLE public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  agreement_type text NOT NULL, -- 'terms_of_service', 'privacy_policy', 'hipaa_responsibilities'
  agreement_version text NOT NULL DEFAULT '1.0',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  accepted_ip text
);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Users can read their own acceptances
CREATE POLICY "Users read own acceptances"
ON public.legal_acceptances FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own acceptances
CREATE POLICY "Users insert own acceptances"
ON public.legal_acceptances FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- System creator can read all for audit
CREATE POLICY "System creator read acceptances"
ON public.legal_acceptances FOR SELECT TO authenticated
USING (is_system_creator());

-- Subscription records (for Paddle/MoR tracking)
CREATE TABLE public.subscription_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'paddle', -- 'paddle', 'stripe', etc.
  provider_customer_id text,
  provider_subscription_id text,
  subscription_status text NOT NULL DEFAULT 'pending', -- 'pending','active','past_due','cancelled','paused'
  plan_id text NOT NULL DEFAULT 'poddispatch_standard',
  current_period_end timestamptz,
  last_payment_status text, -- 'succeeded','failed','refunded'
  last_payment_at timestamptz,
  monthly_amount_cents integer NOT NULL DEFAULT 59900,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_records ENABLE ROW LEVEL SECURITY;

-- Company admin reads own subscription
CREATE POLICY "Admin read own subscription"
ON public.subscription_records FOR SELECT TO authenticated
USING (is_admin() AND company_id = get_my_company_id());

-- System creator reads all subscriptions
CREATE POLICY "System creator read subscriptions"
ON public.subscription_records FOR SELECT TO authenticated
USING (is_system_creator());

-- System creator can update subscriptions (for approval/override)
CREATE POLICY "System creator update subscriptions"
ON public.subscription_records FOR UPDATE TO authenticated
USING (is_system_creator());

-- Onboarding audit log (separate from main audit_logs to avoid PHI mixing)
CREATE TABLE public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL, -- 'signup_started','payment_confirmed','approved','rejected','suspended','override'
  actor_user_id uuid,
  actor_email text,
  details jsonb DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creator read onboarding events"
ON public.onboarding_events FOR SELECT TO authenticated
USING (is_system_creator());

CREATE POLICY "System creator insert onboarding events"
ON public.onboarding_events FOR INSERT TO authenticated
WITH CHECK (is_system_creator());

-- Allow admins to read their own company's onboarding events
CREATE POLICY "Admin read own onboarding events"
ON public.onboarding_events FOR SELECT TO authenticated
USING (is_admin() AND company_id = get_my_company_id());

-- Update companies RLS to allow system creator to update onboarding status
CREATE POLICY "System creator update companies"
ON public.companies FOR UPDATE TO authenticated
USING (is_system_creator());

-- Allow inserts to companies for signup (anon can't, but authenticated new users need it)
-- We'll handle this via edge function with service role key

-- Allow new users to read company they just created (before profile is set)
CREATE POLICY "Owner read own company"
ON public.companies FOR SELECT TO authenticated
USING (owner_user_id = auth.uid());

-- Update trigger for subscription_records
CREATE TRIGGER update_subscription_records_updated_at
BEFORE UPDATE ON public.subscription_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
