
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
  - [x] Procedures (eProcedures), procedure response, SMR device, CPR started-by, ECG rhythm
  - [x] Disposition (eDisposition.12) and Destination type (eDisposition.23)
  - [x] Times (eTimes) — already ISO-8601 timestamptz; matches NEMSIS format, no change
  - [ ] Assessment/injury (eInjury, eSituation) — deferred to Phase 2 (needs new columns for mechanism-of-injury / cause)
  - [x] Backfill script — NOT NEEDED. Phase 1 uses display-as-code (labels round-trip through `findByDisplay`), so historical rows already resolve to a NEMSIS code with no data migration.

**Phase 1 status: DONE for all display-only dropdowns.** Remaining assessment/injury work moves to Phase 2 because it requires new schema columns, not just code-set mapping.

### Phase 2 — Missing NEMSIS mandatory elements
Additive only; no billing-column changes.
  - [x] dAgency populated from `companies` (npi, state_ems_agency_number, state_ems_license_state)
  - [x] dPersonnel populated from `crew_certifications` (state license, cert level)
  - [x] dVehicle populated from `trucks` (unit #, VIN, plate)
  - [ ] eScene / eArrest / eInjury deep audit — deferred until TAC test packet arrives; test packet will surface any missing mandatory fields with concrete failure messages, faster than a speculative audit

### Phase 3 — GEMSIS state-specific elements (`eCustom`)
  - [x] `src/lib/nemsis/states/ga.ts` renders GA eCustom block (loaded miles, wait time, vendor software identity). Real CustomElementIDs slot in when GA DPH sends the current schema with vendor creds.
  - [ ] AL / FL / SC / TN / NC sibling modules — add on demand.

### Phase 4 — XSD schema validation
Blocked on: NEMSIS 3.5.0 XSD download (public but versioned; pull once vendor cert docs list the exact filename). Wire libxmljs2 into the edge function; fail submission on validation error, never block claims.

### Phase 5 — Schematron business rules
Blocked on: NEMSIS Schematron file (bundled with the XSD). Same failure model as Phase 4.

### Phase 6 — NEMSIS XML exporter
  - [x] `src/lib/nemsis/exporter.ts` — `buildERecord` (Web Service) + `buildStateDataSet` (file download) + `buildDemDataSet`
  - [x] 7 unit tests covering escaping, code resolution, test-mode flag, per-state eCustom, xsi:nil for missing values
  - [ ] Swap placeholder XML in edge function to real exporter once module federation for Deno-safe imports is set up (small task)

### Phase 7 — GEMSIS Web Service submission
  - [x] `nemsis_submissions` table (audit trail, RLS-scoped to company, service-role writes only)
  - [x] `submit-gemsis-pcr` edge function (queues + POSTs + records ack/nack)
  - [x] `STATE_ENDPOINTS` map ready to accept endpoints from vendor onboarding
  - [ ] Nightly retry cron — will be scheduled after first real endpoint lands
  - [ ] Hook PCR finalize → `supabase.functions.invoke("submit-gemsis-pcr", ...)` — will wire in when endpoints exist so nothing silently fails today

### Phase 8 — NEMSIS TAC compliance testing
USER ACTION. When TAC test packet arrives: run synthetic PCRs through exporter, submit in test mode, iterate on any validation errors. Last step before vendor listing.

---

## Guardrails (non-negotiable)
- Billing pipeline (`edi-837p-generator.ts`, `claim-readiness.ts`, `queue-claims-for-submission.ts`) is READ-ONLY from NEMSIS phases. It never reads `_code` columns, only display columns.
- `claim-parity.test.ts` runs before/after every phase's PR. A single byte of 837P drift fails the build.
- No user-facing "NEMSIS status" UI. No export buttons on customer screens.
- Submissions are queued + acked in a dedicated `nemsis_submissions` table (created in Phase 7). Never write submission state into `claim_records` or `trip_records`.

## Next session pickup
Continue Phase 1 dropdown coverage: Vitals card first (`src/components/pcr/VitalsCard.tsx`), then Procedures, then Disposition. Each PR adds code sets + dual-write + updates the phase 1 checklist above.
