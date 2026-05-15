REVOKE ALL ON FUNCTION public.enter_creator_simulation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enter_creator_simulation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.enter_creator_simulation(uuid) TO authenticated;