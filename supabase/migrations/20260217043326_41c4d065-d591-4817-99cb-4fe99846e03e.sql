
-- Add phone_number and active status to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Create index for quick lookups on active employees
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);
