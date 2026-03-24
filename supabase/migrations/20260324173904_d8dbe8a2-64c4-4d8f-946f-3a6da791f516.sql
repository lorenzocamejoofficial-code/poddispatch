ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS chair_time_duration_hours integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chair_time_duration_minutes integer DEFAULT 0;