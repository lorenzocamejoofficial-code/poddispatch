ALTER TYPE public.claim_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.claim_status ADD VALUE IF NOT EXISTS 'reversal';
ALTER TYPE public.claim_status ADD VALUE IF NOT EXISTS 'forwarded';