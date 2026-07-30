ALTER TABLE public.crew_certifications
  ADD COLUMN IF NOT EXISTS confirmed_by_user_at timestamptz;

-- Existing crew keep their access: treat everything already on file as confirmed.
UPDATE public.crew_certifications SET confirmed_by_user_at = now() WHERE confirmed_by_user_at IS NULL;

-- Crew members may edit their own certification rows in any status so they can
-- correct what their employer entered. A trigger prevents self-approval.
DROP POLICY IF EXISTS "Users update own pending certs; admins update any" ON public.crew_certifications;
CREATE POLICY "Users update own certs; admins update any"
ON public.crew_certifications FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) OR is_admin() OR is_system_creator())
WITH CHECK ((user_id = auth.uid()) OR is_admin() OR is_system_creator());

CREATE OR REPLACE FUNCTION public.guard_crew_cert_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT (public.is_admin() OR public.is_system_creator()) THEN
    -- A crew member can never approve or manually verify their own credentials.
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
      NEW.status := 'pending_review';
    END IF;
    NEW.manually_verified := OLD.manually_verified;
    NEW.manual_verification_reason := OLD.manual_verification_reason;
    NEW.manual_verification_expires_at := OLD.manual_verification_expires_at;
    IF NEW.status = 'approved' THEN
      NEW.reviewed_by := OLD.reviewed_by;
      NEW.reviewed_at := OLD.reviewed_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_crew_cert_self_update ON public.crew_certifications;
CREATE TRIGGER guard_crew_cert_self_update
BEFORE UPDATE ON public.crew_certifications
FOR EACH ROW EXECUTE FUNCTION public.guard_crew_cert_self_update();