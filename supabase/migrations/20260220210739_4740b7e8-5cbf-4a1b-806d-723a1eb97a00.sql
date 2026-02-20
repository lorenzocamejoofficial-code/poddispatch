
-- ============================================================
-- NEMT OS EXTENSION: Trips & Clinical + Billing & Claims
-- ============================================================

-- 1. PATIENT INSURANCE & TRANSPORT FLAGS (extend existing patients table)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS mobility            text          DEFAULT 'ambulatory',
  ADD COLUMN IF NOT EXISTS oxygen_required     boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS bariatric           boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS standing_order      boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_handling    text,
  ADD COLUMN IF NOT EXISTS primary_payer       text,
  ADD COLUMN IF NOT EXISTS secondary_payer     text,
  ADD COLUMN IF NOT EXISTS member_id           text,
  ADD COLUMN IF NOT EXISTS auth_required       boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_expiration     date,
  ADD COLUMN IF NOT EXISTS trips_per_week_limit integer;

-- 2. TRIP STATUS ENUM
DO $$ BEGIN
  CREATE TYPE public.trip_status AS ENUM (
    'scheduled', 'assigned', 'en_route', 'loaded',
    'completed', 'ready_for_billing', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. TRIP RECORDS (one per truck_run_slot, auto-linked)
CREATE TABLE IF NOT EXISTS public.trip_records (
  id                       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               uuid    REFERENCES public.companies(id),
  slot_id                  uuid    REFERENCES public.truck_run_slots(id) ON DELETE CASCADE,
  leg_id                   uuid    REFERENCES public.scheduling_legs(id),
  patient_id               uuid    REFERENCES public.patients(id),
  run_date                 date    NOT NULL DEFAULT CURRENT_DATE,
  truck_id                 uuid    REFERENCES public.trucks(id),
  crew_id                  uuid    REFERENCES public.crews(id),

  -- Status pipeline
  status                   public.trip_status NOT NULL DEFAULT 'scheduled',

  -- Clinical/operational fields (crew fills)
  loaded_miles             numeric(8,2),
  loaded_at                timestamptz,
  dropped_at               timestamptz,
  wait_time_minutes        integer,
  signature_obtained       boolean  DEFAULT false,
  pcs_attached             boolean  DEFAULT false,
  necessity_notes          text,
  service_level            text     DEFAULT 'BLS',

  -- Auto-filled from scheduling
  scheduled_pickup_time    time,
  pickup_location          text,
  destination_location     text,
  trip_type                public.trip_type DEFAULT 'dialysis',

  -- Billing flags
  billing_blocked_reason   text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trip_records"
  ON public.trip_records FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- 4. CHARGE MASTER (admin-editable rates)
CREATE TABLE IF NOT EXISTS public.charge_master (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid  REFERENCES public.companies(id),
  payer_type      text  NOT NULL DEFAULT 'default',  -- medicare, medicaid, facility, cash, default
  base_rate       numeric(10,2) NOT NULL DEFAULT 0,
  mileage_rate    numeric(10,4) NOT NULL DEFAULT 0,
  wait_rate_per_min numeric(10,4) DEFAULT 0,
  oxygen_fee      numeric(10,2) DEFAULT 0,
  extra_attendant_fee numeric(10,2) DEFAULT 0,
  bariatric_fee   numeric(10,2) DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.charge_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage charge_master"
  ON public.charge_master FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- 5. CLAIM STATUS ENUM
DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM (
    'ready_to_bill', 'submitted', 'paid', 'denied', 'needs_correction'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. CLAIM RECORDS (one per completed trip)
CREATE TABLE IF NOT EXISTS public.claim_records (
  id                uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid  REFERENCES public.companies(id),
  trip_id           uuid  REFERENCES public.trip_records(id) ON DELETE CASCADE,
  patient_id        uuid  REFERENCES public.patients(id),
  run_date          date  NOT NULL,

  -- Payer info (snapshot from patient at time of claim)
  payer_type        text  DEFAULT 'default',
  payer_name        text,
  member_id         text,
  auth_number       text,

  -- Charges (auto-calculated)
  base_charge       numeric(10,2) DEFAULT 0,
  mileage_charge    numeric(10,2) DEFAULT 0,
  extras_charge     numeric(10,2) DEFAULT 0,
  total_charge      numeric(10,2) DEFAULT 0,

  -- Payment
  amount_paid       numeric(10,2),
  denial_reason     text,
  denial_code       text,

  -- Status
  status            public.claim_status NOT NULL DEFAULT 'ready_to_bill',
  submitted_at      timestamptz,
  paid_at           timestamptz,

  -- 837P readiness fields
  icd10_codes       text[],
  cpt_codes         text[],
  origin_zip        text,
  destination_zip   text,

  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claim_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage claim_records"
  ON public.claim_records FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- 7. QA FLAGS
CREATE TABLE IF NOT EXISTS public.qa_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid REFERENCES public.companies(id),
  trip_id        uuid REFERENCES public.trip_records(id) ON DELETE CASCADE,
  claim_id       uuid REFERENCES public.claim_records(id),
  flag_reason    text NOT NULL,
  status         text NOT NULL DEFAULT 'pending',  -- pending, approved, sent_back, adjusted
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  qa_notes       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage qa_reviews"
  ON public.qa_reviews FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- 8. PAYER REQUIRED FIELDS (compliance rules per payer)
CREATE TABLE IF NOT EXISTS public.payer_billing_rules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid REFERENCES public.companies(id),
  payer_type           text NOT NULL DEFAULT 'medicare',
  requires_pcs         boolean DEFAULT false,
  requires_signature   boolean DEFAULT false,
  requires_necessity_note boolean DEFAULT false,
  requires_timestamps  boolean DEFAULT false,
  requires_miles       boolean DEFAULT false,
  requires_auth        boolean DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payer_billing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payer_billing_rules"
  ON public.payer_billing_rules FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- 9. FACILITY PROFILES
CREATE TABLE IF NOT EXISTS public.facilities (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid REFERENCES public.companies(id),
  name              text NOT NULL,
  facility_type     text NOT NULL DEFAULT 'dialysis',  -- dialysis, hospital, snf
  address           text,
  phone             text,
  contact_name      text,
  notes             text,
  active            boolean DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage facilities"
  ON public.facilities FOR ALL
  USING (is_admin() AND company_id = get_my_company_id())
  WITH CHECK (is_admin() AND company_id = get_my_company_id());

-- 10. UPDATED_AT TRIGGERS
CREATE TRIGGER trg_trip_records_updated_at
  BEFORE UPDATE ON public.trip_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_claim_records_updated_at
  BEFORE UPDATE ON public.claim_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.claim_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_reviews;
