-- =============================================================================
-- MIGRATION: Consolidate Simulation Lab into Creator-Owned Test Tenant
-- =============================================================================

-- =============================================================================
-- PHASE 1: Add creator_test_tenant column to companies + index
-- =============================================================================

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS creator_test_tenant BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_companies_creator_test_tenant
ON public.companies(creator_test_tenant)
WHERE creator_test_tenant = TRUE;

-- =============================================================================
-- PHASE 2: Flag Lorenzo Test Company as creator test tenant + sandbox
-- =============================================================================

UPDATE public.companies
SET creator_test_tenant = TRUE,
    is_sandbox = TRUE
WHERE id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789';

-- =============================================================================
-- PHASE 3: Extend get_my_company_id() with creator bypass
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH creator_bypass AS (
    SELECT p.active_company_id AS cid
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = p.active_company_id
          AND c.creator_test_tenant = TRUE
          AND c.deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM public.system_creators sc
        WHERE sc.user_id = auth.uid()
      )
    LIMIT 1
  ),
  active AS (
    SELECT p.active_company_id AS cid
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.active_company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.company_memberships m
        JOIN public.companies c ON c.id = m.company_id
        WHERE m.user_id = auth.uid()
          AND m.company_id = p.active_company_id
          AND c.deleted_at IS NULL
      )
    LIMIT 1
  ),
  member_count AS (
    SELECT count(*) AS n
    FROM public.company_memberships m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.user_id = auth.uid()
      AND c.deleted_at IS NULL
  ),
  fallback AS (
    SELECT m.company_id AS cid
    FROM public.company_memberships m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.user_id = auth.uid()
      AND c.deleted_at IS NULL
      AND (SELECT n FROM member_count) = 1
    LIMIT 1
  )
  SELECT cid FROM creator_bypass
  UNION ALL
  SELECT cid FROM active
  UNION ALL
  SELECT cid FROM fallback
  LIMIT 1;
$$;

-- =============================================================================
-- PHASE 4: Wipe Lorenzo Test Company operational data
-- Each DELETE is wrapped so one FK failure doesn't abort the rest.
-- =============================================================================

DO $$
DECLARE
  v_company_id UUID := 'f53311c3-a40e-4b2b-b4c2-5aec852f7789';
BEGIN

  -- Claim descendants
  BEGIN DELETE FROM public.claim_payments WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'claim_payments: %', SQLERRM; END;
  BEGIN DELETE FROM public.claim_submission_queue WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'claim_submission_queue: %', SQLERRM; END;
  BEGIN DELETE FROM public.claim_submission_artifacts WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'claim_submission_artifacts: %', SQLERRM; END;
  BEGIN DELETE FROM public.ar_followup_notes WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'ar_followup_notes: %', SQLERRM; END;
  BEGIN DELETE FROM public.biller_tasks WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'biller_tasks: %', SQLERRM; END;
  BEGIN DELETE FROM public.claim_creation_failures WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'claim_creation_failures: %', SQLERRM; END;

  -- Trip / PCR descendants
  BEGIN DELETE FROM public.trip_events WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'trip_events: %', SQLERRM; END;
  BEGIN DELETE FROM public.trip_status_history WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'trip_status_history: %', SQLERRM; END;
  BEGIN DELETE FROM public.hold_timers WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'hold_timers: %', SQLERRM; END;
  BEGIN DELETE FROM public.billing_overrides WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'billing_overrides: %', SQLERRM; END;
  BEGIN DELETE FROM public.qa_reviews WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'qa_reviews: %', SQLERRM; END;
  BEGIN DELETE FROM public.operational_alerts WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'operational_alerts: %', SQLERRM; END;
  BEGIN DELETE FROM public.safety_overrides WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'safety_overrides: %', SQLERRM; END;
  BEGIN DELETE FROM public.document_attachments WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'document_attachments: %', SQLERRM; END;

  -- Core billing / clinical records
  BEGIN DELETE FROM public.claim_records WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'claim_records: %', SQLERRM; END;
  BEGIN DELETE FROM public.trip_records WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'trip_records: %', SQLERRM; END;

  -- Scheduling & runs
  BEGIN DELETE FROM public.truck_run_slots WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'truck_run_slots: %', SQLERRM; END;
  BEGIN DELETE FROM public.schedule_change_log WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'schedule_change_log: %', SQLERRM; END;
  BEGIN DELETE FROM public.schedule_previews WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'schedule_previews: %', SQLERRM; END;
  BEGIN DELETE FROM public.scheduling_legs WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'scheduling_legs: %', SQLERRM; END;
  BEGIN DELETE FROM public.runs WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'runs: %', SQLERRM; END;
  BEGIN DELETE FROM public.crews WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'crews: %', SQLERRM; END;
  BEGIN DELETE FROM public.crew_share_tokens WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'crew_share_tokens: %', SQLERRM; END;

  -- Simulation
  BEGIN DELETE FROM public.simulation_runs WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'simulation_runs: %', SQLERRM; END;
  BEGIN DELETE FROM public.simulation_snapshots WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'simulation_snapshots: %', SQLERRM; END;

  -- Assets & operational
  BEGIN DELETE FROM public.patient_schedule_overrides WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'patient_schedule_overrides: %', SQLERRM; END;
  BEGIN DELETE FROM public.patients WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'patients: %', SQLERRM; END;
  BEGIN DELETE FROM public.trucks WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'trucks: %', SQLERRM; END;
  BEGIN DELETE FROM public.facilities WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'facilities: %', SQLERRM; END;
  BEGIN DELETE FROM public.employees WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'employees: %', SQLERRM; END;

  -- Remaining edge-case tables
  BEGIN DELETE FROM public.vehicle_inspections WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vehicle_inspections: %', SQLERRM; END;
  BEGIN DELETE FROM public.vehicle_inspection_alerts WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'vehicle_inspection_alerts: %', SQLERRM; END;
  BEGIN DELETE FROM public.incident_reports WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'incident_reports: %', SQLERRM; END;
  BEGIN DELETE FROM public.import_sessions WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'import_sessions: %', SQLERRM; END;
  BEGIN DELETE FROM public.import_mapping_templates WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'import_mapping_templates: %', SQLERRM; END;
  BEGIN DELETE FROM public.eligibility_checks WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'eligibility_checks: %', SQLERRM; END;
  BEGIN DELETE FROM public.comms_events WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'comms_events: %', SQLERRM; END;
  BEGIN DELETE FROM public.alerts WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'alerts: %', SQLERRM; END;
  BEGIN DELETE FROM public.support_tickets WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'support_tickets: %', SQLERRM; END;
  BEGIN DELETE FROM public.onboarding_events WHERE company_id = v_company_id; EXCEPTION WHEN OTHERS THEN RAISE WARNING 'onboarding_events: %', SQLERRM; END;

END $$;

-- =============================================================================
-- PHASE 5: Delete Manager Test membership (keep auth user intact)
-- =============================================================================

DELETE FROM public.company_memberships
WHERE user_id = 'ea25fad0-bdc9-491a-bbbe-38fc9b31cadf'
  AND company_id = 'f53311c3-a40e-4b2b-b4c2-5aec852f7789';

-- =============================================================================
-- PHASE 6: Soft-delete 22 stale "Simulation Sandbox Co" companies
-- =============================================================================

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id FROM public.companies
    WHERE name = 'Simulation Sandbox Co'
      AND approved_at IS NULL
      AND deleted_at IS NULL
      AND id <> 'f53311c3-a40e-4b2b-b4c2-5aec852f7789'
  LOOP
    UPDATE public.companies
    SET deleted_at = NOW(),
        name = '[wiped] ' || name
    WHERE id = v_rec.id;
  END LOOP;

  -- Reset any profiles pointing to wiped sandboxes
  UPDATE public.profiles
  SET active_company_id = NULL
  WHERE active_company_id IN (
    SELECT id FROM public.companies
    WHERE name LIKE '[wiped] Simulation Sandbox Co'
      AND deleted_at IS NOT NULL
  );
END $$;
