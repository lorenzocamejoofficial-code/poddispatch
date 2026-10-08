CREATE OR REPLACE FUNCTION public.sandbox_cert_bypass(_profile_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.id = _profile_id AND p.company_id = c.id
    WHERE c.id = _company_id
      AND (c.creator_test_tenant IS TRUE OR c.is_sandbox IS TRUE)
  );
$$;
