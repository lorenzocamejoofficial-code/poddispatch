CREATE OR REPLACE FUNCTION public.normalize_payer_class(_v text)
 RETURNS payer_class LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT (CASE
    WHEN r = '' THEN NULL
    WHEN r IN ('medicare') THEN 'medicare'
    WHEN r IN ('medicaid') THEN 'medicaid'
    WHEN r IN ('self_pay','selfpay','self','cash','cash_payment','private_pay','patient') THEN 'self_pay'
    WHEN r IN ('commercial','private','insurance','private_insurance') THEN 'commercial'
    WHEN r IN ('facility','facility_contract','contract') THEN 'facility'
    WHEN r LIKE '%medicaid%' THEN 'medicaid'
    WHEN r LIKE '%medicare%' THEN 'medicare'
    WHEN r LIKE '%self%' OR r LIKE '%cash%' OR r LIKE '%patient%' OR r LIKE '%private\_pay%' OR r = 'privatepay' THEN 'self_pay'
    ELSE NULL END)::public.payer_class
  FROM (SELECT regexp_replace(lower(btrim(coalesce(_v,''))), '[\s\-]+', '_', 'g') AS r) s
$function$;