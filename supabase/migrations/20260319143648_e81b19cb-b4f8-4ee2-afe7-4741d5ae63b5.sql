
-- Allow one-off legs without a permanent patient record
ALTER TABLE public.scheduling_legs ALTER COLUMN patient_id DROP NOT NULL;

-- Add one-off metadata columns
ALTER TABLE public.scheduling_legs ADD COLUMN is_oneoff boolean NOT NULL DEFAULT false;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_name text;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_pickup_address text;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_dropoff_address text;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_weight_lbs integer;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_mobility text;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_oxygen boolean DEFAULT false;
ALTER TABLE public.scheduling_legs ADD COLUMN oneoff_notes text;
