
-- PHASE A: invitation lifecycle on profiles
CREATE TYPE public.invitation_status AS ENUM ('pending_invite','invited','active','inactive');

ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN invitation_status public.invitation_status NOT NULL DEFAULT 'active',
  ADD COLUMN pending_role public.membership_role,
  ADD COLUMN email text;

-- Backfill: existing inactive profiles
UPDATE public.profiles SET invitation_status = 'inactive' WHERE active = false;

CREATE INDEX idx_profiles_company_invitation_status
  ON public.profiles (company_id, invitation_status);

CREATE UNIQUE INDEX idx_profiles_company_email_pending
  ON public.profiles (company_id, lower(email))
  WHERE user_id IS NULL AND email IS NOT NULL;

-- PHASE B: restructure company_invites into a token-only table

-- Migrate any existing pending invites into pending_invite profile rows
INSERT INTO public.profiles (full_name, email, company_id, invitation_status, pending_role, active)
SELECT
  split_part(ci.email, '@', 1),
  ci.email,
  ci.company_id,
  'invited'::public.invitation_status,
  ci.role::public.membership_role,
  true
FROM public.company_invites ci
WHERE ci.status = 'pending'
ON CONFLICT DO NOTHING;

-- Drop old policy that references company_id
DROP POLICY IF EXISTS "Owners manage company invites" ON public.company_invites;

-- Drop unique constraint and columns we no longer need
ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_company_id_email_status_key;
ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS valid_invite_role;
ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS valid_invite_status;
ALTER TABLE public.company_invites DROP CONSTRAINT IF EXISTS company_invites_company_id_fkey;

-- Add profile_id link (nullable for now to allow rewrite of any historical accepted rows)
ALTER TABLE public.company_invites
  ADD COLUMN profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Best-effort link: match historical pending invites to the profile rows we just created
UPDATE public.company_invites ci
SET profile_id = p.id
FROM public.profiles p
WHERE ci.status = 'pending'
  AND p.company_id = ci.company_id
  AND lower(p.email) = lower(ci.email)
  AND p.user_id IS NULL;

-- Drop the data columns moved into profiles
ALTER TABLE public.company_invites
  DROP COLUMN email,
  DROP COLUMN role,
  DROP COLUMN status,
  DROP COLUMN company_id;

ALTER TABLE public.company_invites RENAME COLUMN invited_by TO created_by_user_id;

-- Recreate RLS policy via profile -> company
CREATE POLICY "Owners manage company invites"
  ON public.company_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = company_invites.profile_id
        AND public.is_company_owner_or_creator(p.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = company_invites.profile_id
        AND public.is_company_owner_or_creator(p.company_id)
    )
  );

-- Allow public token validation (anon read by token) — needed by validate-invite flow
-- Token is high-entropy; lookups by token only expose minimal join
-- (handled by edge functions using service role — no anon policy needed)
