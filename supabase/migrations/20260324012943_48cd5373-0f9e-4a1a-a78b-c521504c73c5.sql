-- Add pending_cancellation to trip_status enum
ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'pending_cancellation';

-- Add cancellation columns to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_verified_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_dispatcher_note text,
  ADD COLUMN IF NOT EXISTS cancellation_disputed boolean DEFAULT false;