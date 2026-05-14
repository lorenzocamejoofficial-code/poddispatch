
-- Extend support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS client_context jsonb,
  ADD COLUMN IF NOT EXISTS creator_notes text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ticket_number text;

-- Validation trigger for severity / category / status (avoid CHECK to allow easy edits)
CREATE OR REPLACE FUNCTION public.validate_support_ticket()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.severity NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid severity: %', NEW.severity;
  END IF;
  IF NEW.category IS NOT NULL AND NEW.category NOT IN ('billing','dispatch','clinical','scheduling','account','other') THEN
    RAISE EXCEPTION 'Invalid category: %', NEW.category;
  END IF;
  IF NEW.status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid status: %', NEW.status;
  END IF;
  NEW.updated_at = now();
  IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_validate ON public.support_tickets;
CREATE TRIGGER support_tickets_validate
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_ticket();

-- Ticket number sequence + auto-fill
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.assign_support_ticket_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number = 'PD-' || lpad(nextval('public.support_ticket_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_assign_number ON public.support_tickets;
CREATE TRIGGER support_tickets_assign_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.assign_support_ticket_number();

-- Backfill ticket_number for existing rows
UPDATE public.support_tickets
SET ticket_number = 'PD-' || lpad(nextval('public.support_ticket_number_seq')::text, 6, '0')
WHERE ticket_number IS NULL;

-- RLS: submitter can read their own tickets
DROP POLICY IF EXISTS "Submitters can read their own tickets" ON public.support_tickets;
CREATE POLICY "Submitters can read their own tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: system creator can read all tickets
DROP POLICY IF EXISTS "Creator can read all tickets" ON public.support_tickets;
CREATE POLICY "Creator can read all tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (public.is_system_creator());

-- RLS: system creator can update tickets (notes, status)
DROP POLICY IF EXISTS "Creator can update tickets" ON public.support_tickets;
CREATE POLICY "Creator can update tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created ON public.support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);
