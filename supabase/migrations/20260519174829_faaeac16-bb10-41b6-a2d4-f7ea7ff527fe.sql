
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS pertinent_history jsonb;

ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS pertinent_history jsonb;

COMMENT ON COLUMN public.patients.pertinent_history IS
  'NEMSIS eHistory.08 — pertinent medical/surgical history. Shape: { na: bool, items: string[], other: string }. Supports Medicare ambulance medical-necessity (CMS BPM Ch.10 §10.2).';

COMMENT ON COLUMN public.trip_records.pertinent_history IS
  'Per-PCR snapshot of pertinent history at time of transport (hydrated from patients.pertinent_history on PCR open, editable per-trip).';
