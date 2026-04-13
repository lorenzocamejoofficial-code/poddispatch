-- Add unique partial index on leg_id (only where leg_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS trip_records_leg_id_unique 
ON public.trip_records (leg_id) 
WHERE leg_id IS NOT NULL;