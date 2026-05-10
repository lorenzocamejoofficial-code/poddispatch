-- Normalize profiles.email to lowercase + trimmed on every write.
CREATE OR REPLACE FUNCTION public.normalize_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(btrim(NEW.email));
    IF NEW.email = '' THEN
      NEW.email := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_profile_email ON public.profiles;
CREATE TRIGGER trg_normalize_profile_email
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_profile_email();

-- Partial unique index: one outstanding invite per (company, email).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_company_email_invited_unique
  ON public.profiles (company_id, email)
  WHERE invitation_status = 'invited' AND email IS NOT NULL;