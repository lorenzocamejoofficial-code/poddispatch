
-- Add new columns to incident_reports
ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trip_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_affected text DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS additional_personnel text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

-- Rename column for consistency (emergency_services_contacted -> keep as is, it works)

-- Update RLS: crew can insert for their company
-- Already has: Crew insert incident_reports (INSERT with company_id check)
-- Already has: Admins manage (ALL for owner)
-- Already has: Dispatchers read (SELECT)
-- Need: Dispatchers can UPDATE (mark reviewed)
CREATE POLICY "Dispatchers update incident_reports"
  ON public.incident_reports
  FOR UPDATE
  TO authenticated
  USING (is_dispatcher() AND company_id = get_my_company_id())
  WITH CHECK (is_dispatcher() AND company_id = get_my_company_id());
