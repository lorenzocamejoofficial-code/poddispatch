# NEMSIS CTA Test Harness: pass breakdown, plus Pass 1 in detail

Target: the 2026 Active Test Cases only (DEM 1, EMS 1–5), NEMSIS schema 3.5.1. They are submitted through the pod_dispatch account to the CTA (Compliance Testing Application) web service. Only creators can use it, and it is completely separate from real companies.

## 1. Pass breakdown (dependency order)

Your proposed shape holds. There are two changes: Pass 3 splits off a shared cleanup step, and test-case data comes in per case rather than all at once.

| Pass | What | Done when |
|---|---|---|
| 1 | Transport: pod_dispatch password stored as a secret, request/response handling for the CTA service, its own log table, and a creator-only screen. | A login check returns a real CTA code (for example "allowed: N submissions" or "-1 bad password"), and a test send returns a CTA response we can read. |
| 2 | Test-case data: the exact DEM 1 values from the 2026 packet, stored as one fixed file in the code (not in the database), plus an "inspect" view. | DEM 1 values are typed in and checked against the packet. EMS 1–5 are added later, one per Pass 5 step. |
| 3a | Empty-field fix: the shared XML helper stops marking every empty element as "not values" (xsi:nil with NV). It only does so where the schema allows. This affects real-trip EMS output too. Checked with the existing local schema check and the exporter tests. | The local check is clean and EMS output is unchanged except for the corrected empty fields. |
| 3b | Full agency (DEM) exporter covering every section DEM 1 fills. It builds from the test-case file, not from company records. Local check against the DEM schema. | DEM 1 XML passes the local schema check. |
| 4 | Submit DEM 1, read the CTA result and the CTA website comparison, fix, resend until it passes. | The CTA shows DEM 1 passed. |
| 5 | EMS 1–5, one at a time: add the case data, adjust the EMS exporter to take test-case input (the real-trip path is not changed), check locally, submit, repeat until it passes. | Each case passes in the CTA. |

The two remaining pieces (the empty-field fix and the case data) stay separate so each change can be checked on its own. That matters most because 3a also touches real-trip output.

## 2. Transport spec, confirmed from the live service description

The service description was read today from cta.nemsis.org.

- **Style:** SOAP 1.1, document/literal. It goes to `https://cta.nemsis.org:443/ComplianceTestingWs/endpoints/` with SOAPAction `http://ws.nemsis.org/SubmitData`, and the namespace is `http://ws.nemsis.org/`.
- **Login:** there is no SOAP header and no token step. Every request carries three fields in its body: `username`, `password` and `organization`. Bad credentials come back as code `-1`. Code `-2` means the account isn't allowed that action, and `-3` means it isn't allowed for that organization.
- **SubmitDataRequest fields, in order:** the three login fields, `requestType`=SubmitData, `submitPayload/payloadOfXmlElement` (the DEM or EMS XML is placed directly inside), `requestDataSchema` (**62 = Demographics/DEM**, **61 = EMS**), `schemaVersion`, and `additionalInfo`.
- **SubmitDataResponse:** `requestHandle`, `statusCode` and optional `reports` (server error, XML validation errors, Schematron report, custom reports).
  - `1` = imported. `2`/`3` = imported with error or warning rules flagged.
  - `-11` = duplicate file. `-12` = XML invalid. `-13`/`-14` = fatal or error rule violation. `-15`/`-16` = processing rules. `-30` = message too large. `-20..-22` = server error.
  - `0` = still processing, so ask again with **RetrieveStatus** using the requestHandle.
- **QueryLimit:** it carries only the three login fields and returns the account's submission limit plus a status code. It's a **harmless login check** that sends no data, and Pass 1 uses it first.

**What can't be confirmed without the live service (learned by trying in Pass 1/4):**
- The exact `organization` string the account is tied to. "PodDispatch" is assumed; `-3` would tell us it's wrong.
- The exact `schemaVersion` text: "3.5.1" or the full "3.5.1.251001CP2". We try the short form first; the exporter's root element already declares the full form.
- **How a submission is matched to DEM 1 vs EMS 1 etc.** No field in the service names the test case. The likely answer is that the CTA matches on the data itself: the agency number and the record IDs the packet requires. So the matching happens through the case data in Pass 2/5, not a transport field. We confirm this in Pass 4 by watching where the CTA files the result; `additionalInfo` is the fallback if the CTA wants a label there.
- Whether `0` (pending) comes back for these files, and how long RetrieveStatus takes.

## 3. Where the password lives

- Two server-only secrets: `NEMSIS_CTA_USERNAME` (value `pod_dispatch`, which I can set) and `NEMSIS_CTA_PASSWORD`.
  - The password is a credential from NEMSIS, so **you enter it** in Project Settings → Secrets. I'll ask for it when building starts.
  - An optional `NEMSIS_CTA_ORGANIZATION` (default "PodDispatch") makes a wrong organization a settings change rather than a code change.
- Only the new server function reads them. They never reach the browser, never get written to the log table, and never appear in an error message. The saved copy of each request has the password masked.

## 4. Safety isolation

- **Separate path:** a new server function `nemsis-cta-submit`, gated by the existing `requireSystemCreator` check (`_shared/creator-gate.ts`). Non-creators get "403".
- **No real data can be sent:** the function takes no trip ID, patient ID or company ID. It only accepts a case name from a fixed list (`DEM1`, `EMS1`..`EMS5`, plus `PING` for the login check), and builds XML only from fixture files in the code. No query ever reads trip_records, patients, claims or companies.
- **Separate log:** a new table `nemsis_cta_submissions`. The existing `nemsis_submissions` table, which requires a real company and trip, and `submit-gemsis-pcr` are left untouched. Creators can read the new table; only the server writes to it.
- **Only one address:** the CTA address is a fixed value in the new function, and the function can't send anywhere else. Nothing in the existing PCR submission path calls it.
- **Not touched:** the 837/claims pipeline, denial recovery, existing security rules and company separation, trial/lifecycle, founding, the cancel workflow, and `submit-gemsis-pcr`.

## 5. Pass 1 in detail (transport layer)

**Secrets**
- I set `NEMSIS_CTA_USERNAME=pod_dispatch` (and `NEMSIS_CTA_ORGANIZATION=PodDispatch`).
- You add `NEMSIS_CTA_PASSWORD`.

**Database (one migration)**
- New table `nemsis_cta_submissions` with these fields:
  - `test_case` (text; PING/DEM1/EMS1..5), `operation` (QueryLimit/SubmitData/RetrieveStatus), `data_schema` (61/62, nullable), `schema_version`
  - `request_xml_redacted` (password masked), `response_xml`, `http_status`, `status_code` (int), `status_label` (plain English), `request_handle`, `limit_value`, `error_message`
  - `created_by`, `created_at`
- Access: the server role has full access. Signed-in users can read rows only when they are a system creator (`is_system_creator()`). There is no browser write access.

**Code**
- `supabase/functions/_shared/nemsis/cta-soap.ts`, pure functions:
  - `buildQueryLimitEnvelope(creds)`, `buildSubmitDataEnvelope(creds, payloadXml, dataSchema, schemaVersion, additionalInfo)` and `buildRetrieveStatusEnvelope(creds, handle)`.
    - All text is XML-escaped. The payload has its `<?xml?>` declaration removed and is placed directly inside `payloadOfXmlElement`.
  - `parseCtaResponse(xml)` picks out the SOAP fault, `statusCode`, `requestHandle`, `limit`, and a short summary of the report sections.
  - `describeCtaCode(code)` turns each code from the service description into plain English.
  - `redactPassword(envelope)`.
- `supabase/functions/nemsis-cta-submit/index.ts`:
  - Runs the creator check, then reads `{ action: "ping" | "submit" | "status", test_case?, request_handle? }`, validated with zod.
  - `ping` sends QueryLimit.
  - `submit` in Pass 1 accepts only `test_case: "TRANSPORT_PROBE"`. That sends a small built-in DEM skeleton made from made-up fixture values, purely to prove the round trip. The CTA is expected to reject it (`-12`/`-13`), which is fine for this pass. Real DEM 1/EMS cases unlock in Passes 4/5.
  - `status` sends RetrieveStatus.
  - Posts with `Content-Type: text/xml; charset=utf-8` and the SOAPAction header, with a 30-second timeout.
  - Writes one log row per call and returns the parsed result. Every log write checks its error, so there is no false success.
- `src/lib/nemsis/cta-soap.test.ts`: tests that envelope field order matches the service description, that escaping works, that the password is masked, and that the parser handles the success, failure and fault samples.
- A creator-only screen, **"NEMSIS CTA"**, in the creator area (next to the existing creator tools in `CreatorLayout`):
  - "Check login" button (ping) and "Send transport probe" button.
  - A table of recent CTA calls: time, case, operation, code, plain-English meaning, request handle, and an expandable response XML.
  - A "Check status" button on rows that came back `0`.

**How to verify Pass 1 (what you'd click)**
1. Add `NEMSIS_CTA_PASSWORD` when asked.
2. Go to Creator → NEMSIS CTA and click **Check login**.
   - Pass = a row showing a submission limit with a good status.
   - `-1` = wrong password. `-3` = wrong organization: we change one setting and retry.
3. Click **Send transport probe**. Pass = a row with a real CTA code and response, most likely "-12 XML validation failed" with the CTA's error list visible. That proves the request reached the CTA, was understood, and that we can read its answer.
4. I'll run the same two calls myself and run the new automated tests before reporting.
