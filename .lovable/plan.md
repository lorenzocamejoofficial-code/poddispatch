# Claim-Failure Gate Audit (read-only)

Legend: **EXISTS / PARTIAL / DOES NOT EXIST** · **BLOCKS / WARNS / RECORDS / NONE**

## GATE 1 — Before the trip

**1. PCS on file check**
PARTIAL · WARNS (pre-trip), BLOCKS (only at claim submission when `pcs_on_file=true` and cert date missing).
- `src/lib/pre-trip-readiness.ts:63-66` — flags `"PCS not on file"` for non-emergency/non-private-pay. Advisory (`level: "needs_attention"`), not enforced.
- `src/lib/qa-anomaly-checks.ts:96-104` — post-trip QA flag (`pcs_missing_expired`), red for scheduled / yellow for unscheduled. Queue flag only.
- `src/lib/claim-readiness.ts:315-327` — blocks at biller stage **only if** `claim.pcs_on_file === true` and `pcs_certification_date` is empty. If `pcs_on_file` is false, no block fires.
- DB: `patients.pcs_on_file`, `patients.pcs_expiration_date`, `patients.pcs_physician_npi`, `patients.pcs_physician_name`.

**2. PCS expiration / 60-day window**
PARTIAL · WARNS/BLOCKS on expiry date only. **No 60-day / recertification-window threshold anywhere.**
- `src/components/billing/UpstreamReadinessPanel.tsx` (~expiration check): blocks when `pcs_expiration_date < today`, warns if ≤14 days out. The 14 is a UI reminder, not the CMS 60-day rule.
- `src/lib/qa-anomaly-checks.ts:99` — compares `pcs_expiration_date < trip.run_date` only.
- `rg "60"` across `claim-readiness.ts`, `pre-trip-readiness.ts`, `qa-anomaly-checks.ts` returns no PCS-related 60-day constant. DOES NOT EXIST for the 60-day CMS window specifically.

**3. PCS-stated LOS vs documented condition match**
DOES NOT EXIST.
- No `pcs_level`, `pcs_los`, or equivalent field on `patients` (grep `pcs_level` → 0 hits).
- No code compares PCS-declared level of service against `stretcher_placement` / `bed_confined` / `requires_monitoring`. The stretcher rule at `src/lib/claim-readiness.ts:332-350` only checks that a 2nd ICD-10 exists — it does not consult a PCS-stated LOS.

**4. Prior authorization (RSNAT) tracking**
EXISTS · BLOCKS (at biller/export stage only).
- `src/lib/claim-readiness.ts:79-105` (`isRsnatTransport`) + `:355-377` — blocks when Medicare + (dialysis dest OR standing order OR ≥3x/week recurrence) and `patient.prior_auth_utn` missing or `prior_auth_period_end < run_date`.
- DB: `patients.prior_auth_utn`, `patients.prior_auth_period_end`, `patients.standing_order`, `patients.recurrence_days`.
- No pre-trip block — dispatch can still schedule the run without UTN.

**5. Eligibility / coverage verification before the trip**
PARTIAL · RECORDS (informational only).
- Edge function: `supabase/functions/check-eligibility/index.ts`.
- DB: `eligibility_checks` table (12 cols).
- Callers: only `src/pages/Patients.tsx` and `src/components/patients/InsuranceToolsHeader.tsx`. No caller in `Scheduling.tsx`, `DispatchBoard.tsx`, or the claim-readiness/queue pipeline (`rg check-eligibility src/pages/Scheduling.tsx src/pages/DispatchBoard.tsx src/pages/BillingAndClaims.tsx` → 0 hits). Result never gates a trip or a claim.

**6. Secondary/tertiary coverage discovery**
PARTIAL · RECORDS.
- Edge function: `supabase/functions/discover-coverage/index.ts`.
- DB: `coverage_discoveries` table (21 cols).
- Consumed by `src/pages/OwnerDashboard.tsx`, `src/pages/ReportsAndMetrics.tsx`, `src/pages/MigrationOnboarding.tsx` — surfaces findings only. Nothing auto-attaches a discovered payer to a claim or blocks submission on missing secondary.

**7. Patient signature / authorization capture**
PARTIAL · NONE (hard-coded, not verified).
- `src/lib/edi-837p-generator.ts:612-615` hard-codes `"Y"` for provider and patient signature on file in the CLM segment.
- `trip_records.signatures_json` is checked for existence by QA (`src/lib/qa-anomaly-checks.ts:76-79` — red flag "No crew signature") but `evaluateClaimReadiness` does not require a patient-signature record before EDI generation. Claim will emit `sig-on-file=Y` regardless of what `signatures_json` contains.

## GATE 2 — Point of care

**8. Level-of-service billed vs level documented**
DOES NOT EXIST.
- No code cross-checks the HCPCS on `claim_records.hcpcs_codes` against PCR-documented condition (`bed_confined`, `stretcher_placement`, `requires_monitoring`, `oxygen_during_transport`). `src/lib/edi-837p-generator.ts` and `src/lib/queue-claims-for-submission.ts` pass HCPCS through without any LOS-vs-documentation reconciliation. The 837p comment at `:725` mentions "upcoding/underbilling" but is descriptive, not a check.

**9. Medical necessity fields + validation**
EXISTS (fields) / PARTIAL (validation) · BLOCKS (QA flag red).
- `trip_records`: `bed_confined`, `cannot_transfer_safely`, `requires_monitoring`, `oxygen_during_transport`.
- `src/lib/qa-anomaly-checks.ts:63-65` — if all four are false, red flag `no_medical_necessity`. Enters QA queue; doesn't hard-block claim generation in `claim-readiness.ts` (grep of that file has no reference to those four flags).

## GATE 3 — After adjudication

**10. 835/ERA ingestion**
EXISTS · RECORDS.
- Parser: `src/lib/edi-835-parser.ts` (extracts CLP, CAS, SVC, PLB; aggregates `raw_denial_codes` at claim level).
- Manual upload: `src/pages/RemittanceImport.tsx`.
- Automated pull: `supabase/functions/retrieve-remittance-officeally/index.ts`.
- Ack ingestion: `supabase/functions/ingest-acks-officeally/index.ts`.
- Tables: `remittance_files`, `claim_payments`, `claim_adjustments`, `remittance_quarantine`, `claim_acknowledgments`.

**11. Crossover-failure detection (MA18 / N89 / MA07)**
DOES NOT EXIST.
- `rg "MA18|N89|MA07|crossover"` across `src/lib` and `supabase/functions` returns **zero matches**. No remark-code inspection for crossover success on paid Medicare claims; no auto-detection that a secondary was NOT forwarded.

**12. Timely-filing countdown on un-crossed / unbilled secondary**
PARTIAL · BLOCKS on primary only.
- `src/lib/edi-837p-generator.ts:timelyFilingDays()` + `src/lib/claim-readiness.ts:255-267` block a primary claim past the timely-filing limit.
- No secondary-specific clock: no code scans for paid-primary claims lacking a secondary submission and counts days remaining. Secondary generation exists (`src/lib/create-secondary-claim.ts`, `SecondaryClaimPanel.tsx`) but is manual/on-demand — no timer surfaces expiring secondaries.

**13. Denial capture + rework queue**
EXISTS · RECORDS + surfaces (no forced workflow).
- Parsed: `src/lib/edi-835-parser.ts:242-338` populates `raw_denial_codes` per claim.
- Classified: `src/lib/classify-denial.ts` + `src/lib/denial-code-translations.ts`.
- Surfaced in: `src/pages/BillingAndClaims.tsx` (denial recovery views), `src/hooks/useMissingMoneyScan.ts` category `denial_no_action`, `MissingMoneyPanel.tsx`.
- Queue table: no dedicated `denial_queue` table — denials are surfaced by query against `claim_records` (`denial_code`, `rejection_codes`) + `claim_adjustments`.

## Also requested

**14. Underbilling detection — payable items provided but not on the claim**
DOES NOT EXIST.
- `useMissingMoneyScan` (`src/hooks/useMissingMoneyScan.ts:24-29`) categories are: `no_pcr`, `pcr_not_billed`, `no_followup`, `secondary_not_billed`, `denial_no_action`. All are "claim never went out / never worked" categories. None compare submitted `claim_records.hcpcs_codes` / `hcpcs_modifiers` / `loaded_miles` / `total_charge` against what `trip_records` documented (`oxygen_during_transport`, `bed_confined`, condition modifiers, actual mileage).
- No file matching `rg "underbill"` implements a check; the only occurrence (`src/lib/edi-837p-generator.ts:725`) is a comment.
- `trip_records.oxygen_during_transport` is read into the queue payload (`queue-claims-for-submission.ts:425`) but there is no post-submission reconciliation that flags "oxygen documented, no oxygen line item / modifier billed" or "loaded_miles > billed mileage units."

## Summary counts
- EXISTS + BLOCKS: 2 (RSNAT prior auth at export; timely filing on primary).
- PARTIAL: 8.
- DOES NOT EXIST: 4 (PCS 60-day window, PCS-vs-LOS match, LOS-vs-documentation cross-check, crossover-failure detection, underbilling detection).

End of report — no changes made.
