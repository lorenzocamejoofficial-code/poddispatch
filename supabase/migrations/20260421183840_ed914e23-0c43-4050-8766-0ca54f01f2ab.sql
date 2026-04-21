-- Seed creator settings keys for new toggles
INSERT INTO public.creator_settings (key, value)
VALUES ('email_on_new_signup', 'false'), ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated users to READ maintenance_mode flag (so non-creators can be gated)
-- Existing policies only allow system_creators to read; we add a permissive read for these two specific keys
CREATE POLICY "All authenticated can read public flags"
  ON public.creator_settings FOR SELECT
  TO authenticated
  USING (key IN ('maintenance_mode'));

-- Subscription status history for reactivation MRR tracking
CREATE TABLE public.subscription_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  subscription_record_id uuid,
  old_status text,
  new_status text NOT NULL,
  monthly_amount_cents integer,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid
);

CREATE INDEX idx_sub_status_history_company ON public.subscription_status_history(company_id);
CREATE INDEX idx_sub_status_history_changed_at ON public.subscription_status_history(changed_at);

ALTER TABLE public.subscription_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creators can read subscription_status_history"
  ON public.subscription_status_history FOR SELECT
  TO authenticated
  USING (public.is_system_creator());

CREATE POLICY "Owners can read own company subscription_status_history"
  ON public.subscription_status_history FOR SELECT
  TO authenticated
  USING (company_id = public.get_my_company_id());

-- Trigger function: log every subscription_status change
CREATE OR REPLACE FUNCTION public.log_subscription_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.subscription_status_history
      (company_id, subscription_record_id, old_status, new_status, monthly_amount_cents, changed_at)
    VALUES
      (NEW.company_id, NEW.id, NULL, NEW.subscription_status, NEW.monthly_amount_cents, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.subscription_status IS DISTINCT FROM NEW.subscription_status THEN
    INSERT INTO public.subscription_status_history
      (company_id, subscription_record_id, old_status, new_status, monthly_amount_cents, changed_at)
    VALUES
      (NEW.company_id, NEW.id, OLD.subscription_status, NEW.subscription_status, NEW.monthly_amount_cents, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_subscription_status_change
AFTER INSERT OR UPDATE ON public.subscription_records
FOR EACH ROW
EXECUTE FUNCTION public.log_subscription_status_change();