
ALTER TABLE public.scheduling_legs
  ADD COLUMN origin_type text,
  ADD COLUMN destination_type text;
