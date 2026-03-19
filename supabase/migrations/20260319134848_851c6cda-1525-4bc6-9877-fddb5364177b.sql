-- 1. Add 'cancelled' to run_status enum
ALTER TYPE public.run_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. Add bariatric_stretcher flag to trucks
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS has_bariatric_stretcher boolean NOT NULL DEFAULT false;

-- 3. Add employment_type to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time';