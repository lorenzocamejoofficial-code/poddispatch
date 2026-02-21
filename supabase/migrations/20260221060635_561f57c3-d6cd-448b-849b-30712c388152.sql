
-- Expand trip_status enum with granular lifecycle statuses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'arrived_pickup' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trip_status')) THEN
    ALTER TYPE public.trip_status ADD VALUE 'arrived_pickup';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'arrived_dropoff' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trip_status')) THEN
    ALTER TYPE public.trip_status ADD VALUE 'arrived_dropoff';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'no_show' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trip_status')) THEN
    ALTER TYPE public.trip_status ADD VALUE 'no_show';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'patient_not_ready' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trip_status')) THEN
    ALTER TYPE public.trip_status ADD VALUE 'patient_not_ready';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'facility_delay' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'trip_status')) THEN
    ALTER TYPE public.trip_status ADD VALUE 'facility_delay';
  END IF;
END $$;

-- Add closed-loop financial + documentation columns to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS scheduled_dropoff_time time without time zone,
  ADD COLUMN IF NOT EXISTS expected_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clinical_note text,
  ADD COLUMN IF NOT EXISTS claim_ready boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS blockers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS arrived_pickup_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_dropoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS crew_ids uuid[] DEFAULT '{}';

-- Add denial tracking fields to claim_records  
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS denial_category text,
  ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claim_build_date date;
