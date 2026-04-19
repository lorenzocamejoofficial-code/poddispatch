-- ============ PATIENTS: clinical & billing defaults ============
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS icd10_codes text[],
  ADD COLUMN IF NOT EXISTS default_chief_complaint text,
  ADD COLUMN IF NOT EXISTS default_primary_impression text,
  ADD COLUMN IF NOT EXISTS default_medical_necessity_reason text,
  ADD COLUMN IF NOT EXISTS default_bed_confined boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_cannot_transfer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_requires_monitoring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_oxygen_transport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_bh_authorization_type text,
  ADD COLUMN IF NOT EXISTS default_bh_authorizing_facility text,
  ADD COLUMN IF NOT EXISTS default_bh_authorizing_physician_name text,
  ADD COLUMN IF NOT EXISTS default_bh_authorizing_physician_npi text,
  ADD COLUMN IF NOT EXISTS default_wound_type text,
  ADD COLUMN IF NOT EXISTS default_wound_location text;

-- ============ SCHEDULING_LEGS: one-off transport-specific fields ============
ALTER TABLE public.scheduling_legs
  ADD COLUMN IF NOT EXISTS oneoff_sending_facility_name text,
  ADD COLUMN IF NOT EXISTS oneoff_sending_physician_name text,
  ADD COLUMN IF NOT EXISTS oneoff_sending_physician_npi text,
  ADD COLUMN IF NOT EXISTS oneoff_discharge_reason text,
  ADD COLUMN IF NOT EXISTS oneoff_pcs_obtained boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oneoff_bh_authorization_type text,
  ADD COLUMN IF NOT EXISTS oneoff_bh_1013_received boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oneoff_bh_authorizing_facility text,
  ADD COLUMN IF NOT EXISTS oneoff_bh_authorizing_physician_name text,
  ADD COLUMN IF NOT EXISTS oneoff_law_enforcement_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS oneoff_wound_type text,
  ADD COLUMN IF NOT EXISTS oneoff_wound_location text,
  ADD COLUMN IF NOT EXISTS oneoff_wound_stage text;

-- ============ TRIP_RECORDS: clinical pre-fill targets ============
ALTER TABLE public.trip_records
  ADD COLUMN IF NOT EXISTS chief_complaint text,
  ADD COLUMN IF NOT EXISTS primary_impression text,
  ADD COLUMN IF NOT EXISTS medical_necessity_reason text,
  ADD COLUMN IF NOT EXISTS bh_authorization_type text,
  ADD COLUMN IF NOT EXISTS bh_authorizing_facility text,
  ADD COLUMN IF NOT EXISTS bh_authorizing_physician_name text,
  ADD COLUMN IF NOT EXISTS bh_authorizing_physician_npi text,
  ADD COLUMN IF NOT EXISTS bh_1013_received boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bh_law_enforcement_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sending_facility_json jsonb,
  ADD COLUMN IF NOT EXISTS pcs_attached boolean DEFAULT false;