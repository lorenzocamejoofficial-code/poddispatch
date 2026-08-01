ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS driver_member_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS crew_override_reason text,
  ADD COLUMN IF NOT EXISTS crew_override_by uuid,
  ADD COLUMN IF NOT EXISTS crew_override_at timestamptz;