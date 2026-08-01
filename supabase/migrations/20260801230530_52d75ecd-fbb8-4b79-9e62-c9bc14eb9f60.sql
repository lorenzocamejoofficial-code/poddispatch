-- 1. Normalize legacy payer spellings to the canonical five keys
UPDATE public.patients SET primary_payer = CASE lower(trim(primary_payer))
  WHEN 'cash' THEN 'self_pay' WHEN 'selfpay' THEN 'self_pay' WHEN 'private_pay' THEN 'self_pay'
  WHEN 'facility' THEN 'private' WHEN 'commercial' THEN 'private' WHEN 'insurance' THEN 'private'
  ELSE lower(trim(primary_payer)) END
WHERE primary_payer IS NOT NULL;

UPDATE public.patients SET secondary_payer = CASE lower(trim(secondary_payer))
  WHEN 'cash' THEN 'self_pay' WHEN 'selfpay' THEN 'self_pay' WHEN 'private_pay' THEN 'self_pay'
  WHEN 'facility' THEN 'private' WHEN 'commercial' THEN 'private' WHEN 'insurance' THEN 'private'
  ELSE lower(trim(secondary_payer)) END
WHERE secondary_payer IS NOT NULL;

UPDATE public.charge_master SET payer_type = CASE lower(trim(payer_type))
  WHEN 'cash' THEN 'self_pay' WHEN 'selfpay' THEN 'self_pay' WHEN 'private_pay' THEN 'self_pay'
  WHEN 'facility' THEN 'private' WHEN 'commercial' THEN 'private' WHEN 'insurance' THEN 'private'
  ELSE lower(trim(payer_type)) END
WHERE payer_type IS NOT NULL;

UPDATE public.payer_billing_rules SET payer_type = CASE lower(trim(payer_type))
  WHEN 'cash' THEN 'self_pay' WHEN 'selfpay' THEN 'self_pay' WHEN 'private_pay' THEN 'self_pay'
  WHEN 'facility' THEN 'private' WHEN 'commercial' THEN 'private' WHEN 'insurance' THEN 'private'
  ELSE lower(trim(payer_type)) END
WHERE payer_type IS NOT NULL;

-- 2. De-duplicate charge_master before adding the constraint (keep newest row per payer)
DELETE FROM public.charge_master a
USING public.charge_master b
WHERE a.company_id = b.company_id
  AND lower(a.payer_type) = lower(b.payer_type)
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS charge_master_company_payer_uniq
  ON public.charge_master (company_id, lower(payer_type));