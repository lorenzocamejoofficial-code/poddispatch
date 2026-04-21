-- Expand transport_type enum on patients table
ALTER TYPE public.transport_type ADD VALUE IF NOT EXISTS 'wound_care';
ALTER TYPE public.transport_type ADD VALUE IF NOT EXISTS 'ift';
ALTER TYPE public.transport_type ADD VALUE IF NOT EXISTS 'discharge';
ALTER TYPE public.transport_type ADD VALUE IF NOT EXISTS 'private_pay';
ALTER TYPE public.transport_type ADD VALUE IF NOT EXISTS 'psych_transport';

-- Add default_wound_stage column
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS default_wound_stage text;