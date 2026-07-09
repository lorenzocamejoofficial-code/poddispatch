
DO $$ BEGIN
  CREATE TYPE public.transport_category AS ENUM (
    '911_scene',
    'interfacility_emergency',
    'interfacility_non_emergency',
    'routine_transport',
    'dialysis',
    'hospice',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.scheduling_legs
  ADD COLUMN IF NOT EXISTS transport_category public.transport_category NOT NULL DEFAULT 'unknown';

ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS transport_category public.transport_category NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS idx_trip_records_transport_category
  ON public.trip_records (transport_category);

UPDATE public.scheduling_legs sl
SET transport_category = CASE
  WHEN COALESCE(lower(sl.trip_type::text), '') LIKE '%dialysis%' THEN 'dialysis'::public.transport_category
  WHEN COALESCE(lower(sl.trip_type::text), '') LIKE '%hospice%'  THEN 'hospice'::public.transport_category
  WHEN COALESCE(lower(sl.trip_type::text), '') LIKE '%911%'      THEN '911_scene'::public.transport_category
  WHEN COALESCE(lower(sl.trip_type::text), '') LIKE '%emergen%'  THEN 'interfacility_emergency'::public.transport_category
  WHEN sl.origin_type IS NOT NULL AND sl.destination_type IS NOT NULL
       AND sl.origin_type::text <> 'residence' AND sl.destination_type::text <> 'residence'
    THEN 'interfacility_non_emergency'::public.transport_category
  ELSE 'routine_transport'::public.transport_category
END
WHERE sl.transport_category = 'unknown';

UPDATE public.trip_records tr
SET transport_category = sl.transport_category
FROM public.scheduling_legs sl
WHERE tr.leg_id = sl.id
  AND tr.transport_category = 'unknown'
  AND sl.transport_category <> 'unknown';
