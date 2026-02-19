-- Add ON DELETE CASCADE to foreign keys referencing trucks so related records are automatically cleaned up when a truck is deleted

-- truck_run_slots.truck_id → trucks.id
ALTER TABLE public.truck_run_slots
  DROP CONSTRAINT IF EXISTS truck_run_slots_truck_id_fkey;
ALTER TABLE public.truck_run_slots
  ADD CONSTRAINT truck_run_slots_truck_id_fkey
  FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE CASCADE;

-- crews.truck_id → trucks.id
ALTER TABLE public.crews
  DROP CONSTRAINT IF EXISTS crews_truck_id_fkey;
ALTER TABLE public.crews
  ADD CONSTRAINT crews_truck_id_fkey
  FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE CASCADE;

-- truck_availability.truck_id → trucks.id
ALTER TABLE public.truck_availability
  DROP CONSTRAINT IF EXISTS truck_availability_truck_id_fkey;
ALTER TABLE public.truck_availability
  ADD CONSTRAINT truck_availability_truck_id_fkey
  FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE CASCADE;

-- crew_share_tokens.truck_id → trucks.id
ALTER TABLE public.crew_share_tokens
  DROP CONSTRAINT IF EXISTS crew_share_tokens_truck_id_fkey;
ALTER TABLE public.crew_share_tokens
  ADD CONSTRAINT crew_share_tokens_truck_id_fkey
  FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE CASCADE;

-- alerts.truck_id → trucks.id (nullable, but cascade on delete to avoid orphan alerts)
ALTER TABLE public.alerts
  DROP CONSTRAINT IF EXISTS alerts_truck_id_fkey;
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_truck_id_fkey
  FOREIGN KEY (truck_id) REFERENCES public.trucks(id) ON DELETE SET NULL;