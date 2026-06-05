-- Tertiary insurance + Verify/Discover scaffolding

-- 1) Patients: tertiary payer fields (mirror secondary)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS tertiary_payer text,
  ADD COLUMN IF NOT EXISTS tertiary_member_id text,
  ADD COLUMN IF NOT EXISTS tertiary_group_number text,
  ADD COLUMN IF NOT EXISTS tertiary_payer_id text,
  ADD COLUMN IF NOT EXISTS tertiary_payer_phone text;

-- 2) claim_records: tertiary chain pointers (mirror secondary_claim_*)
ALTER TABLE public.claim_records
  ADD COLUMN IF NOT EXISTS tertiary_claim_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tertiary_claim_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'claim_records'
      AND constraint_name = 'claim_records_tertiary_claim_id_fkey'
  ) THEN
    ALTER TABLE public.claim_records
      ADD CONSTRAINT claim_records_tertiary_claim_id_fkey
      FOREIGN KEY (tertiary_claim_id) REFERENCES public.claim_records(id);
  END IF;
END$$;

-- 3) eligibility_checks: inquiry_mode (verify vs discover)
ALTER TABLE public.eligibility_checks
  ADD COLUMN IF NOT EXISTS inquiry_mode text NOT NULL DEFAULT 'verify';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'eligibility_checks'
      AND constraint_name = 'eligibility_checks_inquiry_mode_chk'
  ) THEN
    ALTER TABLE public.eligibility_checks
      ADD CONSTRAINT eligibility_checks_inquiry_mode_chk
      CHECK (inquiry_mode IN ('verify','discover'));
  END IF;
END$$;

-- 4) coverage_discoveries: results of a Discover (270/271 multi-coverage) lookup
CREATE TABLE IF NOT EXISTS public.coverage_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  -- Allow Discover before a patient exists (search by name+DOB)
  search_first_name text,
  search_last_name text,
  search_dob date,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  discovered_by uuid,
  -- Per-coverage row attributes (one row per discovered policy)
  payer_name text,
  payer_id text,
  member_id text,
  group_number text,
  rank text, -- 'primary' | 'secondary' | 'tertiary' | 'unknown'
  confidence numeric, -- 0..1 from OA
  coverage_start date,
  coverage_end date,
  is_active boolean,
  promoted_to text, -- which slot it was promoted into ('primary'|'secondary'|'tertiary'), null until used
  raw_response jsonb,
  is_simulated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverage_discoveries TO authenticated;
GRANT ALL ON public.coverage_discoveries TO service_role;

ALTER TABLE public.coverage_discoveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coverage_discoveries'
      AND policyname='Admin dispatcher billing read coverage_discoveries'
  ) THEN
    CREATE POLICY "Admin dispatcher billing read coverage_discoveries"
      ON public.coverage_discoveries FOR SELECT TO authenticated
      USING ((is_admin() OR is_dispatcher() OR is_billing()) AND company_id = get_my_company_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coverage_discoveries'
      AND policyname='Owner and billing insert coverage_discoveries'
  ) THEN
    CREATE POLICY "Owner and billing insert coverage_discoveries"
      ON public.coverage_discoveries FOR INSERT TO authenticated
      WITH CHECK ((is_admin() OR is_billing()) AND company_id = get_my_company_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coverage_discoveries'
      AND policyname='Owner and billing update coverage_discoveries'
  ) THEN
    CREATE POLICY "Owner and billing update coverage_discoveries"
      ON public.coverage_discoveries FOR UPDATE TO authenticated
      USING ((is_admin() OR is_billing()) AND company_id = get_my_company_id())
      WITH CHECK ((is_admin() OR is_billing()) AND company_id = get_my_company_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='coverage_discoveries'
      AND policyname='System creator read coverage_discoveries'
  ) THEN
    CREATE POLICY "System creator read coverage_discoveries"
      ON public.coverage_discoveries FOR SELECT TO authenticated
      USING (is_system_creator());
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS coverage_discoveries_patient_idx
  ON public.coverage_discoveries(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS coverage_discoveries_company_idx
  ON public.coverage_discoveries(company_id);

COMMENT ON TABLE public.coverage_discoveries IS
  'Insurance Discovery results (Office Ally 271 multi-coverage). One row per discovered policy. promoted_to set when user copies a row into the patient''s primary/secondary/tertiary slot.';
COMMENT ON COLUMN public.eligibility_checks.inquiry_mode IS
  '''verify'' = 270/271 against a known payer+member ID. ''discover'' = 270/271 to find unknown coverage by name+DOB.';
COMMENT ON COLUMN public.claim_records.tertiary_claim_id IS
  'Chain pointer: tertiary claim spawned after the secondary pays. Mirrors secondary_claim_id which is set after the primary pays.';