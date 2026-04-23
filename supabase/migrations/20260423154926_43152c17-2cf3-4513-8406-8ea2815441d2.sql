CREATE OR REPLACE FUNCTION public.is_protected_record(_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND c.approved_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.company_verifications v
        WHERE v.company_id = _company_id
          AND (v.npi_verified OR v.medicare_enrolled OR v.oig_clear)
      )
  );
$function$;