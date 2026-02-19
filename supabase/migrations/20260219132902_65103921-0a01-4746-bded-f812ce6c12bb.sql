
-- ============================================================
-- HIPAA FOUNDATION: Audit Logs Table
-- ============================================================
-- Tracks who did what, when, to which record.
-- Append-only: no UPDATE or DELETE allowed by any role.
-- Admins can read. Inserts are done via service role / triggers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,                        -- auth.users id of the person taking action
  actor_email   text,                        -- denormalized for readability after user deletion
  action        text NOT NULL,               -- e.g. 'update', 'insert', 'delete', 'login', 'status_change'
  table_name    text,                        -- e.g. 'runs', 'scheduling_legs', 'truck_run_slots'
  record_id     uuid,                        -- primary key of the affected record
  old_data      jsonb,                       -- snapshot before change
  new_data      jsonb,                       -- snapshot after change
  ip_address    text,                        -- captured at edge function level when available
  notes         text                         -- free-form context
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs
CREATE POLICY "Admins read audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (public.is_admin());

-- Only the service role (edge functions) can insert audit entries;
-- no direct client INSERT allowed (enforced by absence of INSERT policy for anon/authenticated)
-- We grant insert via a security-definer function below so future triggers can call it safely.

-- Security-definer helper so future triggers/functions can write audit entries
-- without granting blanket INSERT to authenticated users.
CREATE OR REPLACE FUNCTION public.write_audit_log(
  _actor_user_id uuid,
  _actor_email   text,
  _action        text,
  _table_name    text DEFAULT NULL,
  _record_id     uuid DEFAULT NULL,
  _old_data      jsonb DEFAULT NULL,
  _new_data      jsonb DEFAULT NULL,
  _notes         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs
    (actor_user_id, actor_email, action, table_name, record_id, old_data, new_data, notes)
  VALUES
    (_actor_user_id, _actor_email, _action, _table_name, _record_id, _old_data, _new_data, _notes);
END;
$$;

-- Index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor        ON public.audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
