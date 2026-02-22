
-- Drop and re-add FK on scheduling_legs to cascade patient deletes
ALTER TABLE public.scheduling_legs
  DROP CONSTRAINT scheduling_legs_patient_id_fkey,
  ADD CONSTRAINT scheduling_legs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- Also cascade from scheduling_legs to dependent tables
ALTER TABLE public.truck_run_slots
  DROP CONSTRAINT truck_run_slots_leg_id_fkey,
  ADD CONSTRAINT truck_run_slots_leg_id_fkey
    FOREIGN KEY (leg_id) REFERENCES public.scheduling_legs(id) ON DELETE CASCADE;

ALTER TABLE public.leg_exceptions
  DROP CONSTRAINT leg_exceptions_scheduling_leg_id_fkey,
  ADD CONSTRAINT leg_exceptions_scheduling_leg_id_fkey
    FOREIGN KEY (scheduling_leg_id) REFERENCES public.scheduling_legs(id) ON DELETE CASCADE;

ALTER TABLE public.operational_alerts
  DROP CONSTRAINT operational_alerts_leg_id_fkey,
  ADD CONSTRAINT operational_alerts_leg_id_fkey
    FOREIGN KEY (leg_id) REFERENCES public.scheduling_legs(id) ON DELETE CASCADE;

-- Nullify trip_records.leg_id and trip_records.patient_id on delete (preserve financial records)
ALTER TABLE public.trip_records
  DROP CONSTRAINT trip_records_leg_id_fkey,
  ADD CONSTRAINT trip_records_leg_id_fkey
    FOREIGN KEY (leg_id) REFERENCES public.scheduling_legs(id) ON DELETE SET NULL;

ALTER TABLE public.trip_records
  DROP CONSTRAINT trip_records_patient_id_fkey,
  ADD CONSTRAINT trip_records_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;

-- Nullify claim_records.patient_id on delete (preserve billing records)
ALTER TABLE public.claim_records
  DROP CONSTRAINT claim_records_patient_id_fkey,
  ADD CONSTRAINT claim_records_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;

-- Cascade runs referencing patients
ALTER TABLE public.runs
  DROP CONSTRAINT runs_patient_id_fkey,
  ADD CONSTRAINT runs_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
