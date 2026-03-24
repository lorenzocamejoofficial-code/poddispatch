
-- Add company_id to audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Drop existing RLS policies on audit_logs
DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users insert own audit logs" ON public.audit_logs;

-- New SELECT policy: members read own company's audit logs
CREATE POLICY "Members read own company audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (company_id = public.get_my_company_id());

-- System creators can read all
CREATE POLICY "System creator read all audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_system_creator());

-- Insert policy: authenticated users insert for own company
CREATE POLICY "Authenticated users insert company audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_my_company_id() AND actor_user_id = auth.uid());
