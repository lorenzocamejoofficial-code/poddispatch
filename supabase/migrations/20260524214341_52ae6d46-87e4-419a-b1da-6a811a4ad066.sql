-- Pass 2: payer directory wiring — schema prerequisites

-- 1. Add 'blocked_payer_mapping' to claim_status enum so the queue layer can
--    mark a claim as blocked when payer resolution fails (no silent fallback).
ALTER TYPE public.claim_status ADD VALUE IF NOT EXISTS 'blocked_payer_mapping';

-- 2. Add blocked_reason column on claim_records (the table that owns
--    claim_status). Populated when a claim is blocked from EDI generation.
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

COMMENT ON COLUMN public.claim_records.blocked_reason IS
  'Populated when claim is blocked from EDI generation. Format: <category>: <detail>.';
