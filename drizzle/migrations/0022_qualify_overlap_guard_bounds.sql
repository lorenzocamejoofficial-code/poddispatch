ALTER FUNCTION public.patient_transport_windows(uuid,uuid,date) VOLATILE;
CREATE OR REPLACE FUNCTION public.guard_patient_transport_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 company uuid; patient uuid; day date; pickup time; finish time; duration integer; ignore_trip uuid; ignore_leg uuid;
 actual_start timestamp; actual_end timestamp; target_start timestamp; target_end timestamp; cfg_load integer; cfg_unload integer; base_duration integer;
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
 target_start:=coalesce(actual_start,day+pickup);
 IF target_start IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(company::text||':'||patient::text,0));
 SELECT coalesce(p.run_duration_minutes,30) INTO base_duration FROM public.patients p WHERE p.id=patient AND p.company_id=company;
 SELECT coalesce(s.load_time_minutes,10),coalesce(s.unload_time_minutes,10) INTO cfg_load,cfg_unload FROM public.company_settings s WHERE s.company_id=company LIMIT 1;
 target_end:=coalesce(actual_end,day+finish);
 IF target_end IS NULL THEN target_end:=target_start+make_interval(mins=>greatest(coalesce(duration,base_duration,30),0)+coalesce(cfg_load,10)+coalesce(cfg_unload,10));
 ELSIF target_end<=target_start THEN target_end:=target_end+interval '1 day'; END IF;
 IF EXISTS(SELECT 1 FROM public.patient_transport_windows(company,patient,day) w
 WHERE (ignore_trip IS NULL OR w.trip_id IS DISTINCT FROM ignore_trip)
 AND (ignore_leg IS NULL OR w.leg_id IS DISTINCT FROM ignore_leg)
 AND w.start_at<target_end AND target_start<w.end_at) THEN
  RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PATIENT_TRIP_OVERLAP: This patient already has a transport window that overlaps this one. Choose a non-overlapping time.';
 END IF;
 RETURN NEW;
END;
$$;