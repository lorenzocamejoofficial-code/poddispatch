
BEGIN;

-- Step 1: clean up the 4 orphan company_settings rows
DELETE FROM public.company_settings WHERE company_id IS NULL;

-- Step 2: NOT NULL on 21 tables
ALTER TABLE public.alerts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.charge_master ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.claim_records ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.company_settings ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.crew_share_tokens ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.crews ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.email_send_log ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.facilities ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.operational_alerts ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.patients ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.payer_billing_rules ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.qa_reviews ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.runs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.safety_overrides ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.schedule_previews ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.scheduling_legs ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.trip_records ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.trip_status_history ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.truck_availability ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.truck_run_slots ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.trucks ALTER COLUMN company_id SET NOT NULL;

-- Step 3: column comment on admin_actions.company_id
COMMENT ON COLUMN public.admin_actions.company_id IS
  'NULL is valid only for destructive admin actions (e.g. action=hard_delete_company, archive_company) where the target company no longer exists. All other admin actions must reference a live company.';

-- Step 4: add FK on all 63 tables. SET NULL for nullable-by-design (admin_actions, audit_logs, profiles); RESTRICT for the rest.
DO $$
DECLARE
  r record;
  v_nullable_tables text[] := ARRAY['admin_actions','audit_logs','profiles'];
  v_action text;
  v_fk_name text;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'company_id'
    ORDER BY table_name
  LOOP
    v_fk_name := r.table_name || '_company_id_fkey';
    -- Drop existing FK by this conventional name if present (defensive)
    IF EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = r.table_name AND c.conname = v_fk_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, v_fk_name);
    END IF;

    IF r.table_name = ANY(v_nullable_tables) THEN
      v_action := 'ON DELETE SET NULL';
    ELSE
      v_action := 'ON DELETE RESTRICT';
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES public.companies(id) %s',
      r.table_name, v_fk_name, v_action
    );
  END LOOP;
END $$;

COMMIT;
