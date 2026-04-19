-- Compliance booleans (used in EquipmentCard + Behavioral Health card)
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS restraints_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS aed_used boolean DEFAULT false;

-- Behavioral Health Transport columns
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS bh_authorization_type text,
  ADD COLUMN IF NOT EXISTS bh_1013_received boolean,
  ADD COLUMN IF NOT EXISTS bh_authorizing_facility text,
  ADD COLUMN IF NOT EXISTS bh_authorizing_physician_name text,
  ADD COLUMN IF NOT EXISTS bh_authorizing_physician_npi text,
  ADD COLUMN IF NOT EXISTS bh_form_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bh_law_enforcement_present boolean,
  ADD COLUMN IF NOT EXISTS bh_officer_name text,
  ADD COLUMN IF NOT EXISTS bh_officer_badge text,
  ADD COLUMN IF NOT EXISTS bh_officer_agency text,
  ADD COLUMN IF NOT EXISTS bh_behavioral_assessment text[],
  ADD COLUMN IF NOT EXISTS bh_restraint_type text,
  ADD COLUMN IF NOT EXISTS bh_restraint_reason text,
  ADD COLUMN IF NOT EXISTS bh_restraint_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS bh_neurovascular_checks_documented boolean,
  ADD COLUMN IF NOT EXISTS bh_neurovascular_check_times text,
  ADD COLUMN IF NOT EXISTS bh_patient_response_to_restraints text,
  ADD COLUMN IF NOT EXISTS bh_psych_medications text,
  ADD COLUMN IF NOT EXISTS bh_recent_medication_changes boolean,
  ADD COLUMN IF NOT EXISTS bh_recent_medication_changes_detail text,
  ADD COLUMN IF NOT EXISTS bh_receiving_facility text,
  ADD COLUMN IF NOT EXISTS bh_receiving_clinician text,
  ADD COLUMN IF NOT EXISTS bh_report_given_to text,
  ADD COLUMN IF NOT EXISTS bh_report_time timestamptz;