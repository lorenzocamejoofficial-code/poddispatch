CREATE OR REPLACE FUNCTION public.patient_transport_windows(p_company uuid, p_patient uuid, p_date date)
RETURNS TABLE(trip_id uuid, leg_id uuid, start_at timestamp without time zone, end_at timestamp without time zone)
LANGUAGE sql STABLE SET search_path = public AS $$
WITH config AS (
 SELECT coalesce((select load_time_minutes from public.company_settings where company_id=p_company limit 1),10) AS load,
 coalesce((select unload_time_minutes from public.company_settings where company_id=p_company limit 1),10) AS unload,
 coalesce((select run_duration_minutes from public.patients where id=p_patient and company_id=p_company),30) AS duration
), raw AS (
 SELECT t.id AS trip_id, t.leg_id,
 coalesce(t.at_scene_time AT TIME ZONE 'America/New_York', t.run_date + coalesce(e.pickup_time,t.scheduled_pickup_time)) AS start_at,
 coalesce(t.dropped_at AT TIME ZONE 'America/New_York', t.run_date + t.scheduled_dropoff_time) AS explicit_end,
 greatest(coalesce(l.estimated_duration_minutes,c.duration,30),0)+c.load+c.unload AS minutes
 FROM public.trip_records t CROSS JOIN config c
 LEFT JOIN public.scheduling_legs l ON l.id=t.leg_id AND l.company_id=p_company
 LEFT JOIN public.leg_exceptions e ON e.scheduling_leg_id=l.id AND e.run_date=t.run_date
 WHERE t.company_id=p_company AND t.patient_id=p_patient AND t.run_date BETWEEN p_date-1 AND p_date+1
 AND t.status::text NOT IN ('cancelled','pending_cancellation','no_show')
 UNION ALL
 SELECT null::uuid,l.id,l.run_date+coalesce(e.pickup_time,l.pickup_time),null::timestamp,
 greatest(coalesce(l.estimated_duration_minutes,c.duration,30),0)+c.load+c.unload
 FROM public.scheduling_legs l CROSS JOIN config c
 LEFT JOIN public.leg_exceptions e ON e.scheduling_leg_id=l.id AND e.run_date=l.run_date
 WHERE l.company_id=p_company AND l.patient_id=p_patient AND l.run_date BETWEEN p_date-1 AND p_date+1
 AND NOT EXISTS (SELECT 1 FROM public.trip_records t WHERE t.leg_id=l.id AND t.run_date=l.run_date AND t.company_id=p_company)
 AND NOT EXISTS (SELECT 1 FROM public.truck_run_slots s WHERE s.leg_id=l.id AND s.run_date=l.run_date AND s.company_id=p_company AND s.status::text IN ('cancelled','pending_cancellation','no_show'))
)
SELECT trip_id,leg_id,start_at,CASE WHEN explicit_end IS NULL THEN start_at+make_interval(mins=>minutes) WHEN explicit_end<=start_at THEN explicit_end+interval '1 day' ELSE explicit_end END
FROM raw WHERE start_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.patient_transport_windows(uuid,uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.patient_transport_windows(uuid,uuid,date) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_patient_transport_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 company uuid; patient uuid; day date; pickup time; finish time; duration integer; ignore_trip uuid; ignore_leg uuid;
 actual_start timestamp; actual_end timestamp; start_at timestamp; end_at timestamp; cfg_load integer; cfg_unload integer; base_duration integer;
BEGIN
 IF TG_TABLE_NAME='trip_records' THEN
  IF NEW.status::text IN ('cancelled','pending_cancellation','no_show') THEN RETURN NEW; END IF;
  company:=NEW.company_id; patient:=NEW.patient_id; day:=NEW.run_date; pickup:=NEW.scheduled_pickup_time; finish:=NEW.scheduled_dropoff_time;
  ignore_trip:=NEW.id; ignore_leg:=NEW.leg_id;
  actual_start:=NEW.at_scene_time AT TIME ZONE 'America/New_York'; actual_end:=NEW.dropped_at AT TIME ZONE 'America/New_York';
  SELECT l.estimated_duration_minutes INTO duration FROM public.scheduling_legs l WHERE l.id=NEW.leg_id AND l.company_id=company;
 ELSIF TG_TABLE_NAME='scheduling_legs' THEN
  company:=NEW.company_id; patient:=NEW.patient_id; day:=NEW.run_date; pickup:=NEW.pickup_time; duration:=NEW.estimated_duration_minutes; ignore_leg:=NEW.id;
 ELSE
  SELECT l.company_id,l.patient_id,l.pickup_time,l.estimated_duration_minutes INTO company,patient,pickup,duration FROM public.scheduling_legs l WHERE l.id=NEW.scheduling_leg_id;
  IF company IS NULL THEN RAISE EXCEPTION 'Patient trip company mismatch'; END IF;
  day:=NEW.run_date; pickup:=coalesce(NEW.pickup_time,pickup); ignore_leg:=NEW.scheduling_leg_id;
 END IF;
 IF patient IS NULL OR day IS NULL THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.patients p WHERE p.id=patient AND p.company_id=company) THEN RAISE EXCEPTION 'Patient trip company mismatch'; END IF;
 IF ignore_leg IS NOT NULL AND EXISTS(SELECT 1 FROM public.trip_records t WHERE t.leg_id=ignore_leg AND t.run_date=day AND t.company_id=company AND t.status::text IN ('cancelled','pending_cancellation','no_show')) THEN RETURN NEW; END IF;
 start_at:=coalesce(actual_start,day+pickup);
 IF start_at IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(company::text||':'||patient::text,0));
 SELECT coalesce(p.run_duration_minutes,30) INTO base_duration FROM public.patients p WHERE p.id=patient AND p.company_id=company;
 SELECT coalesce(s.load_time_minutes,10),coalesce(s.unload_time_minutes,10) INTO cfg_load,cfg_unload FROM public.company_settings s WHERE s.company_id=company LIMIT 1;
 end_at:=coalesce(actual_end,day+finish);
 IF end_at IS NULL THEN end_at:=start_at+make_interval(mins=>greatest(coalesce(duration,base_duration,30),0)+coalesce(cfg_load,10)+coalesce(cfg_unload,10));
 ELSIF end_at<=start_at THEN end_at:=end_at+interval '1 day'; END IF;
 IF EXISTS(SELECT 1 FROM public.patient_transport_windows(company,patient,day) w
 WHERE (ignore_trip IS NULL OR w.trip_id IS DISTINCT FROM ignore_trip)
 AND (ignore_leg IS NULL OR w.leg_id IS DISTINCT FROM ignore_leg)
 AND w.start_at<end_at AND start_at<w.end_at) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PATIENT_TRIP_OVERLAP: This patient already has a transport window that overlaps this one. Choose a non-overlapping time.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_patient_transport_overlap() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_patient_transport_overlap() TO service_role;
CREATE TRIGGER guard_patient_trip_overlap BEFORE INSERT OR UPDATE OF patient_id,company_id,run_date,scheduled_pickup_time,scheduled_dropoff_time,at_scene_time,dropped_at ON public.trip_records FOR EACH ROW EXECUTE FUNCTION public.guard_patient_transport_overlap();
CREATE TRIGGER guard_patient_leg_overlap BEFORE INSERT OR UPDATE OF patient_id,company_id,run_date,pickup_time,estimated_duration_minutes ON public.scheduling_legs FOR EACH ROW EXECUTE FUNCTION public.guard_patient_transport_overlap();
CREATE TRIGGER guard_patient_exception_overlap BEFORE INSERT OR UPDATE OF scheduling_leg_id,run_date,pickup_time ON public.leg_exceptions FOR EACH ROW EXECUTE FUNCTION public.guard_patient_transport_overlap();