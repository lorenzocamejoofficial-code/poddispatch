
# GEMSIS/NEMSIS Vendor Certification — Full Roadmap

## Goal
Bring Pod Dispatch to full NEMSIS v3 vendor certification so it appears on the NEMSIS Compliant Software list and can submit PCRs to GEMSIS (Georgia) and neighboring state repositories. Billing to Office Ally MUST remain byte-identical throughout — every phase is gated by `src/lib/claim-parity.test.ts`.

## Locked decisions (from user, do not re-ask)
- **States:** Georgia first; architecture must be pluggable so neighboring states (AL, FL, SC, TN, NC) can be added without touching the exporter core. No hardcoded GA endpoints or GA-only fields in shared code.
- **NEMSIS version:** Target **v3.5.0** (what GA GEMSIS accepts today). Code paths tagged so a v3.5.1 upgrade is a config swap, not a rewrite.
- **Submission methods:** BOTH — file upload (XML download from the app) AND Web Service POST (background edge function). No user-facing export button; submissions run on PCR finalize + nightly retry.
- **Vendor identity:** Pod Dispatch itself does NOT hold an NPI or state EMS agency #. Those live per-company on `public.companies` (NPI already existed; `state_ems_agency_number` + `state_ems_license_state` added in migration `20260712-161021`).
- **Crew credentials:** Already tracked via `crew_certifications` (medic_number = state EMS license, CPR, driver's license). No new crew schema needed for NEMSIS `dPersonnel`.
- **Test mode:** A `nemsis_test_mode` flag on submissions so TAC compliance test PCRs never touch billing.
- **UI surface:** No compliance status shown to end users. Vendor status is a sales conversation only.

## What the user is doing in parallel (do NOT try to automate)
1. Applying to Georgia DPH as a GEMSIS-approved vendor
2. Requesting NEMSIS TAC test credentials
3. Signing GEMSIS data use agreement
4. Passing the NEMSIS TAC compliance test packet (10–20 synthetic PCRs) when credentials arrive

---

## Phase order — DO NOT skip phases

Every phase ends with `bun test claim-parity` passing. If it fails, the phase is not done.

### Phase 1 — Dropdown alignment (IN PROGRESS, ~40% complete)
Swap every PCR dropdown to NEMSIS v3.5.0 code sets via dual-write (`field` = display, `field_code` = NEMSIS code). Billing keeps reading `field`.
  - [x] Code-set library scaffold (`src/lib/nemsis-code-sets.ts`)
  - [x] Translation helper (`src/lib/nemsis-translate.ts`)
  - [x] Airway, Oxygen, LOC, Skin, Medication route/response, Patient sex
  - [x] Vitals categorical pick lists (pulse quality, respiratory effort, ETCO2 method, GCS E/V/M, pain scale type). Numeric vitals (BP/pulse/resp/SpO2/temp/BG) emit as LOINC observations at export time — no card change needed.
  - [ ] Procedures (eProcedures) — full SNOMED procedure list
  - [ ] Assessment/injury (eInjury, eSituation) — mechanism-of-injury, cause, chief complaint
  - [ ] Disposition (eDisposition) — destination, transport method, reason
  - [ ] Times (eTimes) — already mostly aligned, verify format
  - [ ] Backfill script for historical rows

### Phase 2 — Missing NEMSIS mandatory elements
Add fields NEMSIS requires that Pod Dispatch does not yet capture. Each addition is additive (new column or JSONB key), never a mutation of billing columns.
  - dAgency (agency info) — mostly present, populate from `companies`
  - dPersonnel (crew credentials) — populate from `crew_certifications`
  - dVehicle (vehicle info) — populate from `trucks`
  - eRecord/eResponse/eScene/eArrest — audit each for missing mandatory fields

### Phase 3 — GEMSIS state-specific elements (`eCustom`)
GA DPH adds ~15 state-required fields on top of NEMSIS core. Isolated to a per-state module (`src/lib/nemsis/states/ga.ts`) so adding AL/FL/SC/TN/NC is a new file, not a rewrite.

### Phase 4 — XSD schema validation
Validate every generated payload against the NEMSIS 3.5.0 XSD before it leaves the app. Runs on PCR finalize; failures block submission (but never block claim generation).

### Phase 5 — Schematron business rules
Apply NEMSIS's ~200 business-rule assertions. Same failure model as Phase 4.

### Phase 6 — NEMSIS XML exporter
Pure function: `PCR → NEMSIS 3.5.0 XML`. No side effects. Unit-tested against sample PCRs from NEMSIS TAC. Emits both file-download and Web-Service payload formats.

### Phase 7 — GEMSIS Web Service submission
Edge function `submit-gemsis-pcr` that POSTs to GA DPH endpoint, parses ack/nack, stores result in `nemsis_submissions` table, retries on transient failure. Nightly cron for retries. Test-mode flag routes to NEMSIS TAC sandbox endpoint.

### Phase 8 — NEMSIS TAC compliance testing
When user receives TAC test packet: run the 10–20 synthetic PCRs through the exporter, submit via test mode, iterate on any failures. This is the last step before the vendor listing appears.

---

## Guardrails (non-negotiable)
- Billing pipeline (`edi-837p-generator.ts`, `claim-readiness.ts`, `queue-claims-for-submission.ts`) is READ-ONLY from NEMSIS phases. It never reads `_code` columns, only display columns.
- `claim-parity.test.ts` runs before/after every phase's PR. A single byte of 837P drift fails the build.
- No user-facing "NEMSIS status" UI. No export buttons on customer screens.
- Submissions are queued + acked in a dedicated `nemsis_submissions` table (created in Phase 7). Never write submission state into `claim_records` or `trip_records`.

## Next session pickup
Continue Phase 1 dropdown coverage: Vitals card first (`src/components/pcr/VitalsCard.tsx`), then Procedures, then Disposition. Each PR adds code sets + dual-write + updates the phase 1 checklist above.
