
-- 1. Add updated_by column to trip_records
ALTER TABLE public.trip_records ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 2. Create trip_status_history table
CREATE TABLE IF NOT EXISTS public.trip_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  company_id uuid,
  old_status text,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  notes text
);

ALTER TABLE public.trip_status_history ENABLE ROW LEVEL SECURITY;

-- RLS: Creator and Owner — full read for their company
CREATE POLICY "Owners read trip_status_history"
  ON public.trip_status_history FOR SELECT
  TO authenticated
  USING (is_admin() AND company_id = get_my_company_id());

-- RLS: Dispatcher — read last 30 days for their company
CREATE POLICY "Dispatchers read recent trip_status_history"
  ON public.trip_status_history FOR SELECT
  TO authenticated
  USING (
    is_dispatcher() AND company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM public.trip_records tr
      WHERE tr.id = trip_status_history.trip_id
        AND tr.run_date >= (CURRENT_DATE - INTERVAL '30 days')
    )
  );

-- RLS: Billing — read for company trips
CREATE POLICY "Billing read trip_status_history"
  ON public.trip_status_history FOR SELECT
  TO authenticated
  USING (
    is_billing() AND company_id = get_my_company_id()
  );

-- RLS: System creator reads all
CREATE POLICY "System creator read trip_status_history"
  ON public.trip_status_history FOR SELECT
  TO authenticated
  USING (is_system_creator());

-- NO insert/update/delete policies for any role. All writes via trigger only.

-- 3. Create the trigger function
CREATE OR REPLACE FUNCTION public.log_trip_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      INSERT INTO public.trip_status_history (
        trip_id, company_id, old_status, new_status, changed_at, changed_by
      ) VALUES (
        NEW.id, NEW.company_id, OLD.status::text, NEW.status::text, now(), NEW.updated_by
      );
    EXCEPTION WHEN OTHERS THEN
      -- Never block the status update
      RAISE WARNING 'trip_status_history insert failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trg_log_trip_status_change ON public.trip_records;
CREATE TRIGGER trg_log_trip_status_change
  AFTER UPDATE ON public.trip_records
  FOR EACH ROW
  EXECUTE FUNCTION public.log_trip_status_change();
