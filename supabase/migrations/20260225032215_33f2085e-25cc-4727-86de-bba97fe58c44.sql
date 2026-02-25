-- Create billing_overrides table
CREATE TABLE public.billing_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trip_records(id) ON DELETE CASCADE,
  override_reason TEXT NOT NULL,
  overridden_by UUID DEFAULT auth.uid(),
  overridden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_blockers_snapshot JSONB
);

-- Enable RLS
ALTER TABLE public.billing_overrides ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can insert billing overrides"
  ON public.billing_overrides FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read billing overrides"
  ON public.billing_overrides FOR SELECT TO authenticated
  USING (true);

-- Also fix audit_logs: allow authenticated inserts so the override audit trail works
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);