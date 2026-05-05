-- 1. Create the vendor (global) clearinghouse settings table
CREATE TABLE public.vendor_clearinghouse_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id text NOT NULL,
  submitter_name text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_email text,
  -- Receiver fields kept for future multi-clearinghouse support.
  -- Today these default to Office Ally's values; the EDI generator reads
  -- them at runtime and falls back to hardcoded defaults if no row exists.
  receiver_id text NOT NULL DEFAULT '330897513',
  receiver_name text NOT NULL DEFAULT 'OFFICE ALLY',
  -- Global test mode flag. When true, ISA15 = 'T' on all submissions.
  test_mode boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce singleton: only one row can ever exist
CREATE UNIQUE INDEX vendor_clearinghouse_singleton
  ON public.vendor_clearinghouse_settings ((true));

-- Enable RLS
ALTER TABLE public.vendor_clearinghouse_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (EDI generator needs this at runtime)
CREATE POLICY "Authenticated users can read vendor settings"
  ON public.vendor_clearinghouse_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only system creators can write
CREATE POLICY "System creators can insert vendor settings"
  ON public.vendor_clearinghouse_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators can update vendor settings"
  ON public.vendor_clearinghouse_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators can delete vendor settings"
  ON public.vendor_clearinghouse_settings
  FOR DELETE
  TO authenticated
  USING (public.is_system_creator());

-- updated_at trigger
CREATE TRIGGER vendor_clearinghouse_settings_updated_at
  BEFORE UPDATE ON public.vendor_clearinghouse_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Drop deprecated columns from per-tenant clearinghouse_settings.
-- These belonged to PodDispatch as a vendor, not individual customer companies.
-- test_submitter_id is dropped because Office Ally uses the same Submitter ID
-- for test and production traffic, distinguished by the ISA15 usage indicator.
ALTER TABLE public.clearinghouse_settings
  DROP COLUMN IF EXISTS submitter_id,
  DROP COLUMN IF EXISTS submitter_name,
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS receiver_id,
  DROP COLUMN IF EXISTS test_mode,
  DROP COLUMN IF EXISTS test_submitter_id;