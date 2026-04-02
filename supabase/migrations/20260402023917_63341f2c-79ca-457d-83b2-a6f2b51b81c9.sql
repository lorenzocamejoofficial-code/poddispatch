
INSERT INTO public.charge_master (company_id, payer_type, base_rate, mileage_rate, wait_rate_per_min, oxygen_fee, extra_attendant_fee, bariatric_fee)
SELECT c.id, v.payer_type, v.base_rate, v.mileage_rate, v.wait_rate_per_min, v.oxygen_fee, v.extra_attendant_fee, v.bariatric_fee
FROM public.companies c
CROSS JOIN (VALUES
  ('medicare',  389.87, 8.26, 0.00, 0.00, 0.00, 0.00),
  ('medicaid',  300.00, 7.00, 0.00, 0.00, 0.00, 0.00),
  ('facility',  250.00, 6.00, 0.00, 0.00, 0.00, 0.00),
  ('cash',      450.00, 9.00, 0.00, 0.00, 0.00, 0.00),
  ('default',   389.87, 8.26, 0.00, 0.00, 0.00, 0.00)
) AS v(payer_type, base_rate, mileage_rate, wait_rate_per_min, oxygen_fee, extra_attendant_fee, bariatric_fee)
WHERE NOT EXISTS (
  SELECT 1 FROM public.charge_master cm
  WHERE cm.company_id = c.id AND cm.payer_type = v.payer_type
);
