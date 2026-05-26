
-- 1) audit_logs: drop unrestricted insert, replace allowlist with expanded set
DROP POLICY IF EXISTS "Authenticated users insert company audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Members can insert limited audit log entries" ON public.audit_logs;

CREATE POLICY "Members can insert allowlisted audit log entries"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.get_my_company_id()
  AND actor_user_id = auth.uid()
  AND action = ANY (ARRAY[
    -- session / auth
    'user_login','user_logout','session_started','session_ended',
    'password_changed','hipaa_acknowledged',
    -- PHI access
    'view','view_phi','edit','delete','export','export_data',
    -- billing / claims
    'edi_837p_export','edi_837p_queued_for_sftp','pcr_correction',
    'emergency_billing_accept','emergency_billing_override','emergency_billing_escalate',
    -- emergency
    'emergency_upgrade','emergency_void','emergency_resolve',
    -- dispatch / scheduling
    'dispatcher_cancellation','cancellation_documented','cancellation_confirmed','cancellation_disputed',
    'duplicate_override','safety_override',
    'b_leg_early_override','b_leg_time_override',
    'run_cancelled','run_reassigned','run_reassigned_no_crew',
    -- crew / handoff
    'crew_handoff_initiated','crew_handoff_original_signed','crew_handoff_accepted',
    'submit_documentation',
    -- inspection / incident / QA
    'incident_report','vehicle_inspection','qa_pcr_fix',
    -- creator-tenant maintenance
    'creator_data_reset','creator_clear_employees'
  ])
);

-- 2) clearinghouse_credentials: make intent explicit (system creators only)
DROP POLICY IF EXISTS "System creators can read clearinghouse credentials" ON public.clearinghouse_credentials;
CREATE POLICY "System creators can read clearinghouse credentials"
ON public.clearinghouse_credentials
FOR SELECT
TO authenticated
USING (public.is_system_creator());

-- 3) vendor_clearinghouse_settings: restrict reads to system creators only
DROP POLICY IF EXISTS "Privileged users can read vendor settings" ON public.vendor_clearinghouse_settings;
CREATE POLICY "System creators can read vendor settings"
ON public.vendor_clearinghouse_settings
FOR SELECT
TO authenticated
USING (public.is_system_creator());
