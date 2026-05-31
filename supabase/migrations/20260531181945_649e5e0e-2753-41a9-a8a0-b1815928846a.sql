REVOKE ALL ON FUNCTION public.retry_claim_creation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.retry_claim_creation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.retry_claim_creation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.dismiss_claim_creation_failure(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_claim_creation_failure(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.dismiss_claim_creation_failure(uuid) TO authenticated;