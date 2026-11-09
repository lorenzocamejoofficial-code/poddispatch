# Roadmap — RSNAT authorization cap
- [x] Add nullable authorized-trip limit, pure evaluator, shared company-scoped counter and pre-submit cap check; run regression tests (no patient UI)

# Roadmap — company lifecycle fix

- [ ] Pass 1: persist trial dates + expiry sweep + cron auth
- [ ] Pass 2: one trial clock (useAuth, CreatorCompanyDetail, TrialBanner)
- [ ] Pass 3: creator levers (extend trial, comp/activate) — creator-only, reason, history + audit
- [ ] Pass 4: close founding deadlock (ChoosePlan, TrialExpired)
- [ ] Tests (shared clock, sweep idempotency) + build

# Roadmap — unified cancel workflow
- [x] Shared cancelTrip() + "voided" claim status
- [x] Scheduling, Truck Builder, Trips & Clinical flag, crew Confirm Cancel all routed through it
- [x] Billing scan reuses shared void helper
- [x] Tests + build

# Roadmap — NEMSIS CTA test harness
- [x] Pass 1: transport (secrets, SOAP client, nemsis_cta_submissions, nemsis-cta-submit, creator screen, tests)
- [ ] Pass 2-5: fixtures, NV fix + DEM exporter, DEM 1, EMS 1-5 (await approval)

# Roadmap — two-axis classification (transport x payer), one stage at a time
- [x] Stage 0: transport-vocabulary module + tests (no behavior change)
- [x] Stage 1: additive migration (transport_kind enum, payer_class, nullable columns)
- [x] Stage 2: backfill dry-run reviewed and approved
- [x] Stage 3: backfill applied + dual-write triggers (2 no-payer trips left NULL for review)
- [x] Stage 4: clinical readers on transport_kind (ePCR cards/fields/narrative) + parity + SQL/TS drift tests
- [x] Stage 4b: ePCR section rules on transport_kind (emergency upgrade wins)
- [x] Stage 5 billing readers on payer_class (hardened vocabulary, claim payer_class, commercial pricing fix)
- [ ] Stage 6: both intake forms — top-level axes, clinical/payer visibility, visible-field validation, legacy persistence, tests and signed-in verification
- [ ] Stage 7: source-of-truth cutover (awaiting owner review)

# Roadmap — patient time prediction
- [x] Prediction lib + tests, company-scoped stats hook, advisory chips (Scheduling, Patients, truck slots)

# Roadmap — lossless DEM-1 correction
- [x] Lossless DEM export and auditable personnel custom IDs
- [x] Corrected fixture/submitted copy, XSD/Schematron, byte comparison and full tests
- [ ] Resolve baseline DEM compliance findings — blocked on owner decision: original source has 3 contact-mobile errors and 1 vehicle-cost warning; changing those sections is expressly out of scope

# Roadmap — corrected CTA payload wiring
- [x] Promote all six corrected references to submission sources, preserve original software identity, and neutralize insertion scripts
- [x] Regenerate edge fixtures only, verify payload parity, run all six validators and full tests, deploy unchanged CTA logic

# Roadmap — company archive / test purge
- [x] Backend: archive-only delete (reason required), purge_test_company SQL + edge action, loadtest tenants flagged sandbox, tests, synthetic verification
- [ ] UI pass: CreatorConsole archive/purge controls (next pass)
- [ ] Follow-up: session revocation, archived screen, background-job deleted_at checks

# Roadmap — NEMSIS Collect Data certification
- [x] Stage 1: certification company flag, generated-XML submit path, manual resubmit, automatic DEM resend
- [x] Stage 2: in-app XSD + Schematron at finalization
- [x] Stage 3: DEM data-entry screens
- [x] Stage 4: EMS data entry for the five cases
- [ ] Stage 5: defined lists (awaiting user)
- [ ] Stage 6: rehearsal (awaiting user)

# Roadmap — NEMSIS Collect Data certification
- [x] Stage 1: certification company flag + generated-record CTA path
- [x] Stage 2: in-app XSD + Schematron validation and finalize gate
- [x] Stage 3: DEM data model + Agency NEMSIS Profile screens + generated DEM export
- [x] Stage 4: EMS case data model + NEMSIS EMS Cases screens + generated EMS export
- [x] Stage 5: Georgia informational (config-driven state enforcement) + complete defined lists with 3.5.1 manifest
- [ ] Stage 6: rehearsal (awaiting go-ahead)
- [x] Reviewer Schematron upload (creator-only, additive, revertible) on NEMSIS CTA page
- [x] Manual "Create ePCR" for owners/managers
- [x] Scheduling board: advisory "Suggest trucks" ranking (read-only, no auto-assign)
- [x] Facility-only geocode cache (Census, HIPAA: no patient/residential addresses)
- [x] Intake consequence check: S1 geo-aware feasibility, S2 evaluator, S3 Check impact card on one-off form
- [x] Link one-off run endpoints to facility records (one-off form only; recurring/PCR/exceptions deferred)
- [x] History-first timing layer: source tags, patient-readiness warning, impact card source lines (one-off patient picker + recurring-form card = next pass)
- [x] Check impact on the regular (patient) add-run form, using the patient's PCR history
