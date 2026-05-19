UPDATE public.claim_records
SET total_charge = 69.90,
    base_charge = 58.70,
    mileage_charge = 11.20,
    extras_charge = 0,
    updated_at = now()
WHERE id = '4950a7ed-05fa-4cfc-931f-dbf1e00e6347'
  AND original_claim_id = '27d70fe1-d67b-4480-9345-fc091eef7060'
  AND status = 'ready_to_bill';