ALTER TABLE public.coverage_checks ADD COLUMN group_number text, ADD COLUMN payer_id text;
ALTER TABLE public.patients ADD COLUMN primary_group_number text, ADD COLUMN primary_payer_id text;
ALTER TABLE public.coverage_checks DROP CONSTRAINT coverage_checks_review_action_check;
ALTER TABLE public.coverage_checks ADD CONSTRAINT coverage_checks_review_action_check CHECK (review_action IN ('confirmed_primary','confirmed_secondary','confirmed_tertiary','dismissed'));
CREATE FUNCTION public.guard_coverage_policy_identifiers() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.group_number IS DISTINCT FROM OLD.group_number OR NEW.payer_id IS DISTINCT FROM OLD.payer_id THEN RAISE EXCEPTION 'coverage check results are immutable; only review fields may change'; END IF; RETURN NEW; END $$;
CREATE TRIGGER guard_coverage_policy_identifiers_trg BEFORE UPDATE ON public.coverage_checks FOR EACH ROW EXECUTE FUNCTION public.guard_coverage_policy_identifiers();