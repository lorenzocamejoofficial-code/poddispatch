
-- ============================================================
-- OATEST Scenario Validation Harness
-- Creator-only QA tool for end-to-end claim validation against
-- Office Ally's OATEST environment.
-- ============================================================

-- 1. Scenario catalog
CREATE TABLE public.oatest_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  transport_type text NOT NULL,           -- bls, als, bariatric, emergency
  payer_type text NOT NULL,               -- medicare, medicaid, commercial, etc.
  origin_modifier text,                   -- R, H, D, N, S, E, etc.
  destination_modifier text,
  expected_hcpcs text,                    -- A0428, A0429, A0426, A0434, etc.
  expected_modifiers text[] DEFAULT '{}'::text[],
  scenario_template jsonb NOT NULL,       -- full description of how to seed: leg, patient, pcr fields
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_oatest_scenarios_enabled ON public.oatest_scenarios (enabled) WHERE enabled = true;

ALTER TABLE public.oatest_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creators read scenarios"
  ON public.oatest_scenarios FOR SELECT
  TO authenticated
  USING (public.is_system_creator());

CREATE POLICY "System creators insert scenarios"
  ON public.oatest_scenarios FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators update scenarios"
  ON public.oatest_scenarios FOR UPDATE
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators delete scenarios"
  ON public.oatest_scenarios FOR DELETE
  TO authenticated
  USING (public.is_system_creator());

CREATE TRIGGER oatest_scenarios_updated_at
  BEFORE UPDATE ON public.oatest_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Run history
CREATE TABLE public.oatest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.oatest_scenarios(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','seeding','ready','submitted','acked','passed','failed')),
  failure_stage text
    CHECK (failure_stage IN ('seeding','readiness','generator','submission','ack_999','ack_277ca')),
  readiness_issues jsonb,                 -- array of {severity, code, message} from evaluateClaimReadiness
  trip_id uuid,                           -- the seeded trip
  claim_id uuid,                          -- the seeded claim
  artifact_id uuid REFERENCES public.claim_submission_artifacts(id) ON DELETE SET NULL,
  queue_id uuid,                          -- references claim_submission_queue.id (no FK to allow queue cleanup)
  filename text,
  ack_999_raw text,
  ack_999_status text,                    -- A, E, P, R, X
  ack_277ca_raw text,
  ack_277ca_status text,                  -- A, R, etc.
  ik3_loop text,
  ik3_segment text,
  ik3_error_code text,
  failure_summary text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  triggered_by uuid                       -- system creator user id
);

CREATE INDEX idx_oatest_runs_scenario ON public.oatest_runs (scenario_id, started_at DESC);
CREATE INDEX idx_oatest_runs_status ON public.oatest_runs (status) WHERE status IN ('pending','seeding','ready','submitted');

ALTER TABLE public.oatest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System creators read runs"
  ON public.oatest_runs FOR SELECT
  TO authenticated
  USING (public.is_system_creator());

CREATE POLICY "System creators insert runs"
  ON public.oatest_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators update runs"
  ON public.oatest_runs FOR UPDATE
  TO authenticated
  USING (public.is_system_creator())
  WITH CHECK (public.is_system_creator());

CREATE POLICY "System creators delete runs"
  ON public.oatest_runs FOR DELETE
  TO authenticated
  USING (public.is_system_creator());

-- 3. Tag artifacts so we can group them by scenario run
ALTER TABLE public.claim_submission_artifacts
  ADD COLUMN oatest_scenario_id uuid REFERENCES public.oatest_scenarios(id) ON DELETE SET NULL,
  ADD COLUMN oatest_run_id uuid REFERENCES public.oatest_runs(id) ON DELETE SET NULL;

CREATE INDEX idx_csa_oatest_run ON public.claim_submission_artifacts (oatest_run_id) WHERE oatest_run_id IS NOT NULL;

-- ============================================================
-- 4. Seed the starter scenario catalog (12 scenarios)
-- Each template tells the harness how to drive the software:
--   leg.*       — fields for scheduling_legs insert (one-off, sandbox patient)
--   patient.*   — fields for the synthetic patient row
--   pcr.*       — fields the crew app would write to trip_records before pcr_status='submitted'
--   expected.*  — what we expect to see in the generated EDI (validated post-generate)
-- ============================================================

INSERT INTO public.oatest_scenarios
  (slug, name, description, transport_type, payer_type, origin_modifier, destination_modifier, expected_hcpcs, expected_modifiers, scenario_template, notes)
VALUES
  -- BLS Non-Emergency Medicare
  ('bls-medicare-r-h',
   'BLS Non-Emergency · Medicare · Residence → Hospital',
   'Standard bed-confined Medicare ambulance run from a private residence to a hospital. Should produce A0428 with RH modifier and clean 999/277CA.',
   'bls','medicare','R','H','A0428',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('bed_confined',true,'requires_monitoring',false,'icd10_codes',ARRAY['I10','E11.9'],'loaded_miles',12,'medical_necessity_reason','Patient is bed-confined and unable to ambulate or sit safely in a wheelchair.'),
     'expected', jsonb_build_object('hcpcs','A0428','origin_dest_modifier','RH','mileage_units',12)
   ),
   'Baseline Medicare BLS — if this fails, nothing else will pass.'),

  ('bls-medicare-r-d',
   'BLS Non-Emergency · Medicare · Residence → Dialysis',
   'Recurring dialysis transport (A0428 + RD). Verifies PCS handling and weekly cap exemption logic.',
   'bls','medicare','R','D','A0428',ARRAY['RD'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','dialysis','origin_type','residence','destination_type','dialysis','service_level','bls','oneoff_primary_payer','medicare'),
     'patient', jsonb_build_object('pcs_on_file',true,'pcs_expiration_offset_days',60),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['N18.6'],'loaded_miles',8,'medical_necessity_reason','ESRD patient bed-confined; requires stretcher transport for dialysis.'),
     'expected', jsonb_build_object('hcpcs','A0428','origin_dest_modifier','RD','requires_pcs',true)
   ),
   'PCS-required scenario. Dialysis ICD-10 N18.6 is medically appropriate here.'),

  ('bls-medicare-d-r',
   'BLS Non-Emergency · Medicare · Dialysis → Residence',
   'Return leg of a dialysis round trip (A0428 + DR). Tests reverse-modifier handling.',
   'bls','medicare','D','R','A0428',ARRAY['DR'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','dialysis','origin_type','dialysis','destination_type','residence','service_level','bls','oneoff_primary_payer','medicare'),
     'patient', jsonb_build_object('pcs_on_file',true,'pcs_expiration_offset_days',60),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['N18.6'],'loaded_miles',8,'medical_necessity_reason','Post-dialysis patient bed-confined, requires stretcher transport home.'),
     'expected', jsonb_build_object('hcpcs','A0428','origin_dest_modifier','DR','requires_pcs',true)
   ),
   NULL),

  ('bls-medicare-r-n',
   'BLS Non-Emergency · Medicare · Residence → Skilled Nursing',
   'Residence to skilled nursing facility (A0428 + RN). Tests SNF-as-destination billing.',
   'bls','medicare','R','N','A0428',ARRAY['RN'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','snf','service_level','bls','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['I63.9'],'loaded_miles',15,'medical_necessity_reason','Post-stroke patient unable to ambulate; SNF placement.')
   ),
   NULL),

  -- BLS Non-Emergency Medicaid
  ('bls-medicaid-r-h',
   'BLS Non-Emergency · Medicaid · Residence → Hospital',
   'Medicaid BLS to hospital. Verifies payer-specific validation differences from Medicare.',
   'bls','medicaid','R','H','A0428',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicaid'),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['R55'],'loaded_miles',10,'medical_necessity_reason','Bed-confined; unable to sit safely.')
   ),
   NULL),

  ('bls-medicaid-r-d',
   'BLS Non-Emergency · Medicaid · Residence → Dialysis',
   'Medicaid dialysis transport. Some Medicaid plans waive PCS — verifies our payer rules engine.',
   'bls','medicaid','R','D','A0428',ARRAY['RD'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','dialysis','origin_type','residence','destination_type','dialysis','service_level','bls','oneoff_primary_payer','medicaid'),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['N18.6'],'loaded_miles',8,'medical_necessity_reason','ESRD patient requires stretcher transport.')
   ),
   NULL),

  -- ALS Non-Emergency Medicare
  ('als-medicare-r-h',
   'ALS Non-Emergency · Medicare · Residence → Hospital',
   'ALS-level transport (A0426). Requires monitoring documented and ALS-trained crew on PCR.',
   'als','medicare','R','H','A0426',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','hospital','service_level','als','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('bed_confined',true,'requires_monitoring',true,'oxygen_during_transport',true,'icd10_codes',ARRAY['J96.21','I50.9'],'loaded_miles',14,'medical_necessity_reason','ALS-level monitoring required for acute respiratory failure with CHF.')
   ),
   'Tests ALS HCPCS selection AND that monitoring/oxygen flags survive into EDI.'),

  -- BLS Emergency
  ('bls-emergency-s-h',
   'BLS Emergency · Medicare · Scene → Hospital',
   'Emergency response from scene to hospital (A0429 + SH). Verifies emergency PCR path skips PCS check.',
   'bls','medicare','S','H','A0429',ARRAY['SH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','emergency','origin_type','scene','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('is_emergency_pcr',true,'requires_monitoring',true,'icd10_codes',ARRAY['R07.9'],'loaded_miles',6,'chief_complaint','Chest pain','primary_impression','Possible acute coronary syndrome','medical_necessity_reason','Emergency response — chest pain, ALS evaluation en route.')
   ),
   'Emergency path — readiness should NOT require PCS for this scenario.'),

  -- Bariatric (multi-modifier)
  ('bariatric-r-h',
   'Bariatric · Medicare · Residence → Hospital',
   'Bariatric patient requiring bariatric ambulance (A0998 service charge or vendor-specific). Tests safety matrix v2 enforcement and weight documentation.',
   'bariatric','medicare','R','H','A0428',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicare','oneoff_weight_lbs',420,'oneoff_mobility','bariatric'),
     'pcr', jsonb_build_object('bed_confined',true,'weight_lbs',420,'icd10_codes',ARRAY['E66.01'],'loaded_miles',11,'medical_necessity_reason','Bariatric patient (420 lbs) requires bariatric stretcher transport; cannot transfer safely.')
   ),
   'Verifies safety matrix allows the run with a bariatric-equipped truck.'),

  -- Multi-leg round trip with wait time
  ('bls-medicare-rt-wait',
   'BLS Round Trip · Medicare · R→H + H→R with Wait Time',
   'Two-leg round trip with documented wait time at hospital. Verifies wait-time billing accumulation from hold timers.',
   'bls','medicare','R','H','A0428',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','round_trip','origin_type','residence','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['I10'],'loaded_miles',12,'wait_minutes_billable',45,'medical_necessity_reason','Bed-confined patient; outpatient procedure with documented wait.')
   ),
   'Tests B-leg auto-generation AND wait-time integration into the EDI.'),

  -- Long mileage
  ('bls-medicare-long-haul',
   'BLS Non-Emergency · Medicare · Long-Distance Transport (75 miles)',
   'Tests mileage handling at scale and verifies SV1 mileage units segment is correct for high-mileage runs.',
   'bls','medicare','R','H','A0428',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY['C50.911'],'loaded_miles',75,'medical_necessity_reason','Bed-confined oncology patient; specialty hospital transport.')
   ),
   NULL),

  -- Negative test
  ('negative-missing-icd10',
   'NEGATIVE · Missing ICD-10 should block at readiness',
   'Intentionally omits ICD-10 codes. Should fail at readiness gate and never reach the generator. If it does reach OA, that is a software bug we want to catch.',
   'bls','medicare','R','H','A0428',ARRAY['RH'],
   jsonb_build_object(
     'leg', jsonb_build_object('trip_type','one_way','origin_type','residence','destination_type','hospital','service_level','bls','oneoff_primary_payer','medicare'),
     'pcr', jsonb_build_object('bed_confined',true,'icd10_codes',ARRAY[]::text[],'loaded_miles',10,'medical_necessity_reason','Bed-confined patient.'),
     'expected', jsonb_build_object('expect_failure_stage','readiness')
   ),
   'PASS criterion: failure_stage=readiness. FAIL criterion: anything else, including a clean OA accept.');
