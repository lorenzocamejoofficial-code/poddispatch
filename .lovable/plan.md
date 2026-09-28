# NEMSIS Submission Path Audit (read-only, nothing changed)

## Bottom line
Getting a test case into the CTA sandbox is a **real build, not a wiring job**. The software can make EMS XML from real trips. It has **no** SOAP envelope, **no** CTA address, **no** place for the pod_dispatch login, **no** way to hold test-case data, and only a thin DEM (agency) file.

## 1. The exporter — PARTIAL
- `src/lib/nemsis/exporter.ts` (778 lines). An edge copy lives at `supabase/functions/_shared/nemsis/exporter.ts` and is synced by `scripts/sync-nemsis-to-edge.sh`.
- `buildEmsDataSet` (`:758-769`) builds EMSDataSet → Header → DemographicGroup → PatientCareReport, filled from a `trip_records` row. Sections are listed at `:695-716`. Georgia custom fields come from `states/ga.ts`, and those IDs are placeholders such as "GA-LoadedMiles" (`ga.ts:33-36`).
- `buildDemDataSet` (`:741-752`) is a skeleton. It has only dRecord, dAgency.01-04, dPersonnel and dVehicle (`:638-679`). Other DEM sections that DEM 1 needs (contacts, configuration, locations, facilities and more) are not there. It has never been checked against the DEM schema, and nothing calls it.
- `scripts/nemsis-validate.ts` checks one made-up EMS record against the XSD using xmllint (`:90-94`). It does not check DEM, and it does not use CTA test-case values.
- `el()` (`xml-utils.ts:40-43`) adds `xsi:nil NV="7701003"` to every empty element. The schema rejects that on elements that don't allow NV, so it's a likely source of validation errors.
- **Test cases: DOESN'T EXIST.** The exporter only accepts a real trip and patient. Nothing in the repo mentions DEM 1 or EMS 1-5.

## 2. Endpoint and transport — DOESN'T EXIST
- `supabase/functions/submit-gemsis-pcr/index.ts:35-37`:
  `GA: { prod: null, test: null }, // populated after GA DPH vendor onboarding`
- `:176-188`: with no endpoint, the row stays `queued` and only the XML is saved.
- There is no CTA or nemsis.org submission address anywhere in `src/` or `supabase/`.
- The only POST code is a plain `fetch(endpoint, {Content-Type: application/xml, body: payloadXml})` (`:195-199`). It sends raw XML, not SOAP, and is never reached.
- `test_mode` defaults to true (`:55`), but it just picks the same null slot.

## 3. VSA login — DOESN'T EXIST
- No secret name, settings field or database column exists for the NEMSIS username or password. A search for VSA or NEMSIS user/pass finds nothing.
- The POST at `:195-199` sends no login at all.

## 4. SOAP and login format — DOESN'T EXIST
- There is no SOAP envelope and no SubmitData request with username, password, organization "PodDispatch", data-schema code or schema version.
- Nothing builds or reads a SOAP response or fault.
- The "accepted" check is a guess: a regex on `<Nack|<Error` (`:201`), not the real NEMSIS status codes.

## 5. Results and status — PARTIAL, mostly out of scope
- The `nemsis_submissions` table (migration `20260712162915`) has status, payload_xml, ack_xml, endpoint_url, retry_count and error_message. Signed-in users can read it (`:24-30`).
- Nothing ever writes a real NEMSIS response, and there is no status check or results page. The retry job is only noted as "to be scheduled" in memory.
- CTA results and the comparison view live only in the CTA website. Pass/fail tracking is done there, not in the software.

## 6. The gap: real build
Missing pieces for DEM 1 end to end:
1. **Test-case data:** a way to hold the exact DEM 1 values from the CTA packet (hand-built fixtures or an entry screen).
2. **Full DEM exporter:** every section DEM 1 fills, in the correct order, with the right not-recorded rules. It must validate against `DEMDataSet_v3.xsd` and the NEMSIS rule checks.
3. **Nil/NV fix:** only emit NV where the schema allows it.
4. **Login storage:** the NEMSIS username and password stored as server-side secrets that the submit function reads.
5. **SOAP builder:** a SubmitData envelope with the login, organization "PodDispatch", request type, submit type, data-schema code (DEM vs EMS), schema version 3.5.1 and the XML payload.
6. **CTA address:** the CTA web-service URL, taken from the CTA test-packet docs (not confirmed in the repo).
7. **Response handling:** read the SOAP response code, status and message, save it to `nemsis_submissions`, and treat faults as errors.
8. **A trigger:** a creator-only "Submit test case" action. Today the function runs only after a PCR is finalized, needs a trip ID (`:51-54`) and checks company membership (`:76-82`). That doesn't fit a DEM test case.
9. **Schema version:** confirm the version CTA 2026 expects. The code points at 3.5.1.251001CP2 (`exporter.ts:766`).

EMS 1-5 need the same pieces, plus a record matching each case's scenario, which is more than the trip mapping handles today.

## 7. How test cases would be driven — DOESN'T EXIST
No fixtures, table or screen exists for test-case data. The practical approach: store each CTA case as a fixed input file (DEM context plus EMS trip/patient). Run it through the exporter, validate it locally with xmllint, then submit it from a creator-only screen that shows the saved response. Real trips and billing are never touched.

## Suggested next step (only if approved)
Plan a creator-only "NEMSIS CTA Test Harness" in this order:
1. Add the NEMSIS username and password as secrets.
2. Build the SOAP client and the CTA address.
3. Build the full DEM exporter and the DEM 1 fixture, validated with xmllint.
4. Submit DEM 1 and save the response.
5. Then do EMS 1-5.

Nothing is built until you approve.
