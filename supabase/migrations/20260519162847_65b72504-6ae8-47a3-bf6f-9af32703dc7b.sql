
-- Patients table doesn't have deleted_at; drop the filter.
CREATE OR REPLACE FUNCTION public.generate_pcs_expiration_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_expiration date;
  v_severity text;
  v_priority int;
  v_msg text;
  v_recipient uuid;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.company_id,
           p.first_name || ' ' || p.last_name AS patient_name,
           p.pcs_signed_date,
           (SELECT MIN(sl.run_date) FROM public.scheduling_legs sl
             WHERE sl.patient_id = p.id AND sl.company_id = p.company_id
               AND sl.run_date >= CURRENT_DATE) AS next_trip_date
    FROM public.patients p
    WHERE p.pcs_on_file = true
      AND p.pcs_signed_date IS NOT NULL
  LOOP
    IF r.next_trip_date IS NULL THEN CONTINUE; END IF;
    v_expiration := r.pcs_signed_date + 60;

    IF v_expiration < r.next_trip_date THEN
      v_severity := 'critical'; v_priority := 1;
    ELSIF v_expiration - r.next_trip_date <= 14 OR v_expiration - CURRENT_DATE <= 14 THEN
      v_severity := 'warning'; v_priority := 1;
    ELSE
      CONTINUE;
    END IF;

    v_msg := format('PCS %s for %s: signed %s, expires %s (next trip %s).',
      CASE WHEN v_severity='critical' THEN 'EXPIRED' ELSE 'expiring' END,
      r.patient_name, r.pcs_signed_date, v_expiration, r.next_trip_date);

    IF NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.patient_id = r.patient_id AND t.task_type = 'pcs_expiring'
        AND t.status IN ('pending','in_progress')
    ) THEN
      INSERT INTO public.biller_tasks (company_id, patient_id, task_type, priority, title, description, due_date)
      VALUES (r.company_id, r.patient_id, 'pcs_expiring', v_priority,
              'PCS ' || v_severity || ' — ' || r.patient_name, v_msg,
              LEAST(v_expiration, r.next_trip_date));
    END IF;

    FOR v_recipient IN
      SELECT user_id FROM public.company_memberships
       WHERE company_id = r.company_id AND role IN ('owner','creator','manager','biller')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient AND n.notification_type = 'pcs_expiring'
          AND n.related_patient_id = r.patient_id
          AND n.created_at > now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, message, notification_type, related_patient_id)
        VALUES (v_recipient, v_msg, 'pcs_expiring', r.patient_id);
      END IF;
    END LOOP;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_pcs_expiration_alerts failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_rsnat_auth_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_days_left int;
  v_severity text;
  v_priority int;
  v_msg text;
  v_recipient uuid;
BEGIN
  FOR r IN
    SELECT p.id AS patient_id, p.company_id,
           p.first_name || ' ' || p.last_name AS patient_name,
           p.prior_auth_utn, p.prior_auth_period_end,
           (SELECT MIN(sl.run_date) FROM public.scheduling_legs sl
             WHERE sl.patient_id = p.id AND sl.company_id = p.company_id
               AND sl.run_date >= CURRENT_DATE) AS next_trip_date
    FROM public.patients p
    WHERE p.prior_auth_utn IS NOT NULL
      AND p.prior_auth_period_end IS NOT NULL
  LOOP
    IF r.next_trip_date IS NULL THEN CONTINUE; END IF;
    v_days_left := r.prior_auth_period_end - CURRENT_DATE;

    IF v_days_left < 0 THEN
      v_severity := 'critical-expired'; v_priority := 1;
    ELSIF v_days_left <= 7 THEN
      v_severity := 'critical'; v_priority := 1;
    ELSIF v_days_left <= 30 THEN
      v_severity := 'warning'; v_priority := 1;
    ELSE
      CONTINUE;
    END IF;

    v_msg := format('RSNAT auth %s for %s (UTN %s): expires %s — %s days, next trip %s.',
      v_severity, r.patient_name, r.prior_auth_utn, r.prior_auth_period_end,
      v_days_left, r.next_trip_date);

    IF NOT EXISTS (
      SELECT 1 FROM public.biller_tasks t
      WHERE t.patient_id = r.patient_id AND t.task_type = 'auth_expiring'
        AND t.status IN ('pending','in_progress')
    ) THEN
      INSERT INTO public.biller_tasks (company_id, patient_id, task_type, priority, title, description, due_date)
      VALUES (r.company_id, r.patient_id, 'auth_expiring', v_priority,
              'RSNAT auth ' || v_severity || ' — ' || r.patient_name, v_msg,
              GREATEST(CURRENT_DATE, r.prior_auth_period_end));
    END IF;

    FOR v_recipient IN
      SELECT user_id FROM public.company_memberships
       WHERE company_id = r.company_id AND role IN ('owner','creator','manager','biller')
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient AND n.notification_type = 'auth_expiring'
          AND n.related_patient_id = r.patient_id
          AND n.created_at > now() - interval '7 days'
      ) THEN
        INSERT INTO public.notifications (user_id, message, notification_type, related_patient_id)
        VALUES (v_recipient, v_msg, 'auth_expiring', r.patient_id);
      END IF;
    END LOOP;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'generate_rsnat_auth_alerts failed: %', SQLERRM;
END;
$$;
