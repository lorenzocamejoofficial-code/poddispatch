# NEMSIS "Collect Data" readiness audit (read-only, nothing changed)

Bottom line: **we are not ready for a live data-entry certification.** The six passing cases only prove that hand-maintained XML files pass. The app's real ePCR can produce an EMS XML for a trip, but nothing connects entered data to the CTA, and no screen exists for entering DEM/agency configuration.

## 1. UI data-entry coverage: PARTIAL (EMS) / MISSING (DEM)
- **Has real UI:** ePCR fields in `src/pages/PCRPage.tsx` and `src/components/pcr/*`: times, vitals, airway, assessments, disposition, signatures. Patient/payer fields are in `src/pages/Patients.tsx`. Truck and crew records are in `TrucksCrews.tsx`.
- **No UI:** dPersonnel.901 / eCrew.901 (Crew Member National EMS ID). No employee or crew screen captures it; the values exist only in the fixtures. There is also no screen for any dConfiguration element (procedure groups, medication groups, protocols, cert levels, devices), dVehicle detail, dContact or dLocation. The richer EMS elements in the fixtures (eArrest, eExam groups, eCustomResults, eOutcome, etc.) come from the optional `PcrExportInput.nemsis` structure in `src/lib/nemsis/ems-record.ts`. No form fills that structure.
- I haven't done a full element-by-element count across the five EMS fixtures. That count should come first if you want an exact list.

## 2. Workflow: PARTIAL (EMS) / MISSING (DEM)
- EMS: Scheduling → trip → `/pcr` (PCRPage) → document → submit PCR. A trip-level submission is wired to `submit-gemsis-pcr`.
- DEM: no route creates a demographic configuration. The Onboarding Wizard collects basic company and fleet data, not NEMSIS DEM data. `buildDemDataSet` has no app caller apart from the exporter.

## 3. Pipeline: MISSING for the CTA (the key question)
- `supabase/functions/nemsis-cta-submit/index.ts` (lines 3 and 26–31) imports only the static `DEM1/EMS1–5_SUBMISSION_XML` constants from `_shared/nemsis/fixtures/*.ts`. Its header states it never reads tenant data. The only screen that sends to it is `src/pages/CreatorNemsisCta.tsx`.
- `supabase/functions/submit-gemsis-pcr/index.ts` does build XML from real database records (`trip_records`, `trucks`, `trip_crew_assignments` → `buildEmsDataSet`, line 164). But it posts to state GEMSIS endpoints (`STATE_ENDPOINTS`), not the CTA. It also uses the legacy trip mapping, without the rich `nemsis` structure.
- This split was deliberate. A project rule keeps real tenant data away from the CTA sandbox, and the NEMSIS path is frozen. Connecting entered data to the CTA needs your decision, for example a dedicated sandbox/test company whose records are allowed through.

## 4. Schematron: PARTIAL
- `cta-soap.ts` maps the CTA status codes (including code 3, "Imported with WARNING-level violations"). `extractCtaValidationErrors` (line 218) parses the XSD and Schematron messages the CTA returns. `nemsis-cta-submit` stores them in `nemsis_cta_submissions.validation_errors`, and `CreatorNemsisCta.tsx` displays them.
- Missing: the app runs no Schematron of its own. Today's checks run only offline (`npm run nemsis:validate`). So results appear only after a CTA round-trip, and only on the creator panel for fixture payloads. Breaking a rule through entered data can't be shown, because entered data never reaches the CTA (see area 3). I haven't confirmed that the extractor separates WARNING from ERROR in the display.

## 5. NEMSIS Defined Lists: PARTIAL
- `src/lib/nemsis-code-sets.ts` (marked v3.5.1, about 194 coded entries) supplies dropdowns in 4 files (for example `AirwayCard.tsx`). It covers ePCR picklists only, not the full national lists (procedures, medications, ICD/SNOMED, DEM lists, state lists). I haven't checked whether the code sets match the current 3.5.1 data dictionary. Many ePCR fields are still free text or app-specific values.

## Gaps that would block the live meeting (in priority order)
1. **CTA submissions can't come from entered data.** The submit function only sends static fixtures. This is the main blocker, and it needs your decision to unfreeze the NEMSIS path.
2. **No screens for DEM data:** agency, contacts, configuration groups, protocols, cert levels, devices, vehicle detail and personnel, including National EMS ID (dPersonnel.901).
3. **The ePCR can't capture the elements the five cases need.** The rich EMS data, including eCrew.901 and custom results, has no form; it exists only in the fixtures.
4. **No visible error/warning check on entered data.** Schematron needs to run on XML built from entered data, with WARNING and ERROR shown in the app.
5. **Code lists are incomplete.** They need the full national and state defined lists as dropdowns, with a source version recorded.

Realistic note: closing gaps 1–4 is a multi-week build. You could ask NEMSIS whether a later meeting slot is possible.
