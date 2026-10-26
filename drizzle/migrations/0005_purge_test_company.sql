CREATE OR REPLACE FUNCTION public.purge_test_company(_company_id uuid, _dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Child-before-parent order. Every table with a RESTRICT/NO ACTION FK to
  -- companies(id) MUST appear here (guarded by purge-test-company.test.ts).
  -- Inter-table edges honoured: qa_reviews->claim_records,
  -- claim_creation_failures/crews/trip_records/schedule_change_log->profiles,
  -- trip_events/trip_records->crews, hold_timers->truck_run_slots,
  -- schedule_change_log->scheduling_legs, eligibility_checks/incident_reports->patients,
  -- comms_events->facilities, *->trucks.
  _tables text[] := ARRAY[
    'qa_reviews','claim_creation_failures','claim_submission_artifacts','claim_submission_queue',
    'claim_payments','claim_adjustments','plb_adjustments','ar_followup_notes','biller_tasks',
    'coverage_discoveries','eligibility_checks','incident_reports','document_attachments',
    'hold_timers','comms_events','trip_events','operational_alerts','schedule_change_log',
    'safety_overrides','trip_status_history','trip_projection_state','claim_records','trip_records',
    'alerts','daily_truck_metrics','truck_risk_state','truck_run_slots','runs',
    'patient_schedule_overrides','scheduling_legs','crews','crew_share_tokens',
    'vehicle_inspection_alerts','vehicle_inspections','vehicle_inspection_templates',
    'truck_availability','truck_builder_templates','schedule_previews','trucks','facilities',
    'patients','remittance_files','charge_master','payer_billing_rules','payer_directory',
    'customer_payer_enrollments','clearinghouse_credentials','clearinghouse_settings',
    'import_sessions','import_mapping_templates','migration_settings','legal_acceptances',
    'onboarding_events','company_verifications','subscription_status_history',
    'subscription_records','support_tickets','email_send_log','company_settings',
    'company_memberships'
  ];
  _t text;
  _n bigint;
  _counts jsonb := '{}'::jsonb;
  _co record;
  _orphans uuid[];
  _keep uuid[];
BEGIN
  SELECT id, name, is_sandbox, creator_test_tenant INTO _co
  FROM public.companies WHERE id = _company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purge_test_company: company % not found', _company_id;
  END IF;
  IF NOT (COALESCE(_co.is_sandbox,false) OR COALESCE(_co.creator_test_tenant,false)) THEN
    RAISE EXCEPTION 'purge_test_company: refused — % is not a test/sandbox tenant', _company_id
      USING ERRCODE = '42501';
  END IF;

  -- Users who will have no membership anywhere else (and are not system creators).
  SELECT COALESCE(array_agg(DISTINCT m.user_id), '{}') INTO _orphans
  FROM public.company_memberships m
  WHERE m.company_id = _company_id
    AND NOT EXISTS (SELECT 1 FROM public.company_memberships o
                    WHERE o.user_id = m.user_id AND o.company_id <> _company_id)
    AND NOT EXISTS (SELECT 1 FROM public.system_creators sc WHERE sc.user_id = m.user_id);

  -- Profiles pointing here that must survive (other memberships or creators).
  SELECT COALESCE(array_agg(p.id), '{}') INTO _keep
  FROM public.profiles p
  WHERE (p.company_id = _company_id OR p.active_company_id = _company_id)
    AND NOT (p.user_id = ANY(_orphans));

  FOREACH _t IN ARRAY _tables LOOP
    IF _dry_run THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id = $1', _t) INTO _n USING _company_id;
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', _t) USING _company_id;
      GET DIAGNOSTICS _n = ROW_COUNT;
    END IF;
    _counts := _counts || jsonb_build_object(_t, _n);
  END LOOP;

  IF _dry_run THEN
    SELECT count(*) INTO _n FROM public.profiles
      WHERE (company_id = _company_id OR active_company_id = _company_id) AND user_id = ANY(_orphans);
    _counts := _counts || jsonb_build_object('profiles_deleted', _n,
                                             'profiles_detached', COALESCE(array_length(_keep,1),0));
  ELSE
    UPDATE public.profiles SET
      company_id = CASE WHEN company_id = _company_id THEN NULL ELSE company_id END,
      active_company_id = CASE WHEN active_company_id = _company_id THEN NULL ELSE active_company_id END
    WHERE id = ANY(_keep);
    _counts := _counts || jsonb_build_object('profiles_detached', COALESCE(array_length(_keep,1),0));
    DELETE FROM public.profiles
      WHERE (company_id = _company_id OR active_company_id = _company_id) AND user_id = ANY(_orphans);
    GET DIAGNOSTICS _n = ROW_COUNT;
    _counts := _counts || jsonb_build_object('profiles_deleted', _n);
    DELETE FROM public.companies WHERE id = _company_id;
  END IF;

  RETURN jsonb_build_object(
    'company_id', _company_id, 'company_name', _co.name, 'dry_run', _dry_run,
    'counts', _counts, 'orphan_user_ids', to_jsonb(_orphans));
END;
$$;

REVOKE ALL ON FUNCTION public.purge_test_company(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_test_company(uuid, boolean) TO service_role;