# NEMSIS 3.5.1 "Collect Data" certification: gap analysis, build plan and estimate

Planning only; nothing has been changed. Bottom line: certification needs a real path from entered data to validation, finalization and the CTA. Today's passes come only from static XML files (`src/lib/nemsis/fixtures/*.xml`) sent from `src/pages/CreatorNemsisCta.tsx`.

## Status of the 8 requirements

**1. DEM data-entry screens: MISSING**
- Exists: basic company and fleet data in `OnboardingWizard.tsx` and `TrucksCrews.tsx`. A data-driven builder, `buildDemDataSet(DemographicProfile)`, is in `src/lib/nemsis/exporter.ts`.
- Missing: no stored DEM model and no screens for dAgency, dContact, dConfiguration (procedure, medication and protocol groups, cert levels), dVehicle, dPersonnel, dDevice, dFacility or dLocation. `buildDemDataSet` has no app caller.

**2. EMS data-entry screens for the five cases: PARTIAL**
- Exists: the ePCR in `src/pages/PCRPage.tsx` and `src/components/pcr/*` covers times, vitals, airway, assessment, disposition and signatures.
- Missing: forms that fill the structured `PcrExportInput.nemsis` (`src/lib/nemsis/ems-record.ts`). The cases need eArrest, eInjury, repeated eExam groups, eProcedures/eMedications with full codes, eOutcome, eOther and eCustomResults. Today those exist only in the fixtures. An element-by-element coverage matrix against the five cases is the first task.

**3. Change a value and resubmit; DEM auto-resubmits: MISSING**
- Exists: `nemsis_cta_submissions` history plus the per-trip state submission `supabase/functions/submit-gemsis-pcr`. That function sends to GEMSIS, not the CTA.
- Missing: CTA submission from database records, a resubmit action, and a trigger that sends a new DEMDataSet when a national DEM element changes.

**4. Crew Member National EMS ID (dPersonnel.901 / eCrew.901): MISSING in UI**
- Exists: values exist only in the fixtures. The ID mapping rule is in memory.
- Missing: a stored field on the employee/personnel record, entry UI, display on the ePCR crew section, and export with the matching custom-configuration declaration (dCustomConfiguration / eCustomConfiguration).

**5. In-app Schematron at finalization (four scenarios, national + state files): MISSING**
- Exists: offline only. `scripts/nemsis/validate.mjs` uses system xmllint plus the Schematron files in `tests/nemsis/schematron`. `cta-soap.ts` `extractCtaValidationErrors` parses the CTA's messages after a submission.
- Missing: a server-side validation service that runs every configured Schematron file (national + GA). It needs to return messages with their level, error-blocks/warning-allows finalization for both DEM and EMS, and a results panel in the UI.

**6. NEMSIS Defined Lists in data entry: PARTIAL**
- Exists: `src/lib/nemsis-code-sets.ts` (marked 3.5.1, about 194 codes) feeds a few ePCR dropdowns.
- Missing: the complete national defined lists for every coded element on the new screens, and the DEM lists. The DEM configuration determines which procedures, medications and protocols the ePCR offers. Also missing: GA state lists and a record of each list's source version.

**7. XSD validation at finalization: MISSING in app**
- Exists: offline xmllint against `tests/nemsis/xsd`. Generated XML is XSD-valid in tests.
- Missing: XSD runs inside the same validation service, with blocking at finalization.

**8. Submit entered data to the CTA via the current web service: PARTIAL**
- Exists: the SOAP client in `cta-soap.ts` works, and `nemsis-cta-submit` is proven against the CTA. But it imports only static `*_SUBMISSION_XML` fixtures and is designed never to read tenant data.
- Missing: a path that builds XML from the certification company's records and sends that.

## Decision needed on the freeze and the data guardrail

The current rules (NEMSIS path frozen; no tenant data to the CTA) must be explicitly relaxed in a narrow way. Recommendation:
- **Unfreeze the NEMSIS path for this project only.** Keep the six static fixtures as a regression baseline, but no longer as what gets submitted.
- **Create a dedicated certification company** flagged as test/sandbox, holding only synthetic NEMSIS test-case data. The CTA submit function would accept records only when they belong to a company that is flagged as test/sandbox and specially marked for certification. Real companies stay refused on the server, and the CTA address stays hardcoded.
- Submissions remain creator-only and manual: one click per submission, never automatic, except the required automatic DEM resubmission, which applies only inside the certification company.
- Record the new rule in AGENTS.md, replacing the current fixture-only rule.

## Build order and estimate

Estimates assume one focused developer with AI help, and include tests.

1. **Stage 0: coverage matrix and decisions** (1–2 days). List every element in the six cases, map each to existing fields or "new", and sign off on the guardrail above.
2. **Stage 1: certification company and submit path** (2–3 days). Add the certification flag and the server-side guard. Have the submit function build XML from database records, keeping the fixture mode for regression. Add a resubmit button.
3. **Stage 2: validation service** (4–6 days). Run XSD plus all Schematron files (national + state) on the server. A Deno edge function can't run xmllint or the XSLT 2 Schematron engine, so this needs a JS/WASM engine (for example a libxml2 WASM build plus SaxonJS). Its feasibility is the biggest technical risk, so prototype it first. Then gate finalization (error blocks, warning allows) and add a messages panel for DEM and EMS.
4. **Stage 3: DEM data model and screens** (8–12 days). Add tables for agency, contacts, configuration groups, protocols, cert levels, vehicles, personnel (with National EMS ID), devices and locations. Build screens with defined-list dropdowns, an "agency NEMSIS profile" page, and automatic DEM resubmission when a national element changes.
5. **Stage 4: EMS data entry for the five cases** (10–15 days). Add structured storage for the `PcrExportInput.nemsis` sections and ePCR cards for the missing sections. Show eCrew.901 in the crew section, and limit procedure/medication choices to the DEM configuration.
6. **Stage 5: defined lists** (3–5 days, overlapping Stages 3–4). Import the official national and GA lists into versioned code tables used by every coded field.
7. **Stage 6: rehearsal** (3–4 days). Enter all six cases through the screens only, compare against the references with `nemsis:diff`, and submit to the CTA. Rehearse the four Schematron scenarios and the change-and-resubmit flow.

**Total: about 31–47 working days (6–9 weeks) for one developer; about 4–6 weeks with two developers working in parallel.** The biggest risks are the Stage 2 validation engine, how much of the case data is still uncovered (the Stage 0 matrix will firm this up), and possible changes to the current 3.5.1 Schematron/lists versions.

## Not yet verified
- Element-by-element counts per case (Stage 0 produces these).
- Whether `nemsis-code-sets.ts` matches the current published lists.
- Whether the CTA message parser separates WARNING from ERROR in the creator panel.
