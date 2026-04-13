
-- Add last_contacted_at to claim_records
ALTER TABLE public.claim_records ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

-- Create AR follow-up notes table
CREATE TABLE public.ar_followup_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.claim_records(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_followup_notes_claim ON public.ar_followup_notes(claim_id);
CREATE INDEX idx_ar_followup_notes_company ON public.ar_followup_notes(company_id);

-- Enable RLS
ALTER TABLE public.ar_followup_notes ENABLE ROW LEVEL SECURITY;

-- Billers and owners can view notes for their company
CREATE POLICY "Billing users can view AR notes for their company"
ON public.ar_followup_notes FOR SELECT
TO authenticated
USING (company_id = public.get_my_company_id() AND public.is_billing());

-- Billers and owners can insert notes for their company
CREATE POLICY "Billing users can insert AR notes for their company"
ON public.ar_followup_notes FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_my_company_id() AND public.is_billing());
