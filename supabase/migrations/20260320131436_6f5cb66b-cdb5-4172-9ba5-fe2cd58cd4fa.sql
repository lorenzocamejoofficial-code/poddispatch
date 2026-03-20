-- Fix 1: Remove public USING(true) policy on company_invites
-- Invite lookup is now done server-side via validate-invite edge function
DROP POLICY IF EXISTS "Read invite by token" ON public.company_invites;

-- Fix 2: Tighten audit_logs INSERT so users can only attribute actions to themselves
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users insert own audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());