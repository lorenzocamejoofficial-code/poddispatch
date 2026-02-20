
-- 1. Add origin_type and destination_type to trip_records
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS origin_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS destination_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hcpcs_codes text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hcpcs_modifiers text[] DEFAULT NULL;

-- 2. Add origin_type and destination_type to claim_records
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS origin_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS destination_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hcpcs_codes text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hcpcs_modifiers text[] DEFAULT NULL;

-- 3. Add facility contract fields
ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS contract_payer_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'medicare',
  ADD COLUMN IF NOT EXISTS invoice_preference text DEFAULT 'per_trip';

-- 4. Enable realtime for facilities
ALTER PUBLICATION supabase_realtime ADD TABLE public.facilities;
