-- ============================================================
-- Data retention & deletion controls
-- ============================================================

-- 1. company_verifications: append-only snapshot at approval time
CREATE TABLE public.company_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL,
  approver_email text,
  approved_at timestamptz NOT NULL DEFAULT now(),
  npi_verified boolean NOT NULL DEFAULT false,
  npi_result jsonb,
  medicare_enrolled boolean NOT NULL DEFAULT false,
  medicare_result jsonb,
  oig_clear boolean NOT NULL DEFAULT false,
  oig_result jsonb,
  manual_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_verifications_company ON public.company_verifications(company_id);
ALTER TABLE public.company_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creator manages verifications"
  ON public.company_verifications
  FOR ALL TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

CREATE POLICY "Owner reads own verification"
  ON public.company_verifications
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());


-- 2. admin_actions: immutable audit of archive/delete/restore by creator
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,            -- 'archive_company' | 'hard_delete_company' | 'restore_company'
  company_id uuid,                 -- nullable since we may keep the row after hard delete
  company_name text,
  was_protected boolean NOT NULL DEFAULT false,
  reason text,
  before_snapshot jsonb,
  stripe_cancel_status text,       -- 'cancelled' | 'no_subscription' | 'failed: <msg>' | 'skipped'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_actions_company ON public.admin_actions(company_id);
CREATE INDEX idx_admin_actions_created ON public.admin_actions(created_at DESC);
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creator reads admin actions"
  ON public.admin_actions
  FOR SELECT TO authenticated
  USING (public.is_system_creator());

-- No INSERT/UPDATE/DELETE policies — writes happen via service role from edge functions only.


-- 3. is_protected_record: single source of truth for delete-vs-archive decision
-- Protected if:
--   - approved AND has at least one true verification snapshot, OR
--   - any submitted PCR exists for the company (defense-in-depth)
CREATE OR REPLACE FUNCTION public.is_protected_record(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = _company_id
        AND c.approved_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.company_verifications v
          WHERE v.company_id = _company_id
            AND (v.npi_verified OR v.medicare_enrolled OR v.oig_clear)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.trip_records t
      WHERE t.company_id = _company_id
        AND t.pcr_status = 'submitted'
        AND COALESCE(t.is_simulated, false) = false
    );
$$;


-- 4. Tighten companies RLS to filter out soft-deleted records for everyone
--    EXCEPT system creators (who must still see archived rows).
DROP POLICY IF EXISTS "Members read own company" ON public.companies;
DROP POLICY IF EXISTS "Owner read own company" ON public.companies;
DROP POLICY IF EXISTS "Admins update own company" ON public.companies;

CREATE POLICY "Members read own company"
  ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.get_my_company_id() AND deleted_at IS NULL);

CREATE POLICY "Owner read own company"
  ON public.companies
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "Admins update own company"
  ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.get_my_company_id() AND public.is_admin() AND deleted_at IS NULL);


-- 5. Update get_my_company_id so soft-deleted companies stop being "my company".
--    Members of an archived company effectively lose all data access via RLS,
--    because every other table's policy keys off get_my_company_id().
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.company_id
  FROM public.company_memberships m
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.user_id = auth.uid()
    AND c.deleted_at IS NULL
  LIMIT 1;
$$;


-- 6. Fix stripe-webhook column mismatch:
--    The webhook writes to stripe_customer_id / stripe_subscription_id but
--    subscription_records actually stores them in provider_*_id. Add the
--    aliases as generated columns? No — that's awkward. Simplest fix is to
--    add the columns the webhook expects and let provider_*_id remain for
--    legacy rows; or update the webhook. We add the columns here so writes
--    succeed; the edge function archive flow reads provider_subscription_id
--    OR stripe_subscription_id (whichever is populated).
ALTER TABLE public.subscription_records
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE INDEX IF NOT EXISTS idx_subscription_records_stripe_sub
  ON public.subscription_records(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Backfill: provider_subscription_id may already hold the Stripe ID for
-- companies that completed checkout pre-migration.
UPDATE public.subscription_records
   SET stripe_subscription_id = provider_subscription_id
 WHERE stripe_subscription_id IS NULL
   AND provider_subscription_id IS NOT NULL
   AND provider = 'stripe';

UPDATE public.subscription_records
   SET stripe_customer_id = provider_customer_id
 WHERE stripe_customer_id IS NULL
   AND provider_customer_id IS NOT NULL
   AND provider = 'stripe';
