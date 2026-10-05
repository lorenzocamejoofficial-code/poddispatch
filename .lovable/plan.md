# Two-axis trip classification (Transport Type x Payer) — recommended plan

## Recommendation in one line
Go incremental (expand -> backfill -> migrate readers -> migrate writers -> contract), NOT one consolidating migration. The type fields are read in ~40 files plus a DB trigger and 4 server functions, and three of them already disagree on vocabulary; a single cutover would silently change which ePCR sections are required and which rate a claim is priced at.

## What exists today (verified)

Live data (small, which makes backfill easy to audit by hand):

```text
patients.transport_type   dialysis 5, discharge 1, ift 1, outpatient 1, psych_transport 1, wound_care 1
trip_records.trip_type    dialysis 8, discharge 5, ift 4, outpatient 4, psych_transport 4, wound_care 4
trip_records.pcr_type     ift_general 12, ift_discharge 5, nemt_dialysis 5, ift_wound_care 4, dialysis 1, empty 2
scheduling_legs.trip_type dialysis 26, wound_care 6, discharge 1
patients.primary_payer    medicare 7, medicaid 2, self_pay 1
trip_records.primary_payer medicare 9, medicaid 9, commercial 8, empty 3
```

Findings that shape the plan:
- No row currently stores private_pay as a transport type. The conflation is in code paths and enum lists, not data — the risky backfill case is empty today but must still be handled.
- pcr_type is a fourth vocabulary (ift_general, nemt_dialysis, ift_wound_care...) that the code normalizes with substring matching; "emergency" is only ever set on pcr_type (emergency upgrade), never on trip_type.
- trip_records.primary_payer still holds legacy "commercial" (canonical is "private").
- woundcare vs wound_care: duplicate exists only as an enum value; no rows use "woundcare".
- NEMSIS/CTA code does not read these fields by name — no frozen-path changes needed.

## Blast radius

```text
WRITERS
  Patient form            Patients.tsx (transport_type, primary_payer, oneoff none)
  One-off runs            Scheduling.tsx (scheduling_legs.trip_type, oneoff_primary_payer)
  Trip creation           PCRPage.createTripForRun, TripsAndClinical.syncSlotsToTrips
                          (pcr_type := leg.trip_type), TripsAndClinical manual form
  Emergency upgrade       useEmergencyUpgrade.tsx (pcr_type='emergency')
  Server functions        simulation-lab, loadtest-harness, oatest-run (seed data)

READERS — clinical (Axis 1)
  ePCR sections           usePCRSectionRules.ts (normalizePCRType, has a private_pay column)
  ePCR field reqs         pcr-field-requirements.ts (normalizeTransportKey + PAYER_AUGMENTATIONS)
  ePCR submit             PCRPage.getMissingItems (substring checks on trip_type/pcr_type)
  Patient intake reqs     pcr-dropdowns.ts TRANSPORT_TYPE_CLAIM_REQUIREMENTS (has private_pay key)
  Cards                   PatientInfoCard, MedicalNecessityCard
  Safety / readiness      safety-rules.ts, pre-trip-readiness.ts, transport-context.ts
  Crew + dispatch views   CrewSchedule, CrewPatients, CrewDashboard, CrewScheduleAdmin,
                          UpcomingNonDialysisPanel
  DB trigger              auto_flag_trip_qa (reads a type field)

READERS — billing (Axis 2)
  Claim trigger           auto_create_claim_on_pcr_submit (payer cascade: trip -> patient -> leg -> default)
  Readiness / checklist   claim-readiness.ts, PreSubmitChecklist.tsx (also gates on private_pay transport)
  Submission              queue-claims-for-submission.ts (self_pay hard block)
  Payer helpers           payer-vocabulary.ts, payer-compliance.ts (+ generated edge copy)
  Reports / exports       generate-audit-export, ReportsAndMetrics
```

Where a big-bang consolidation would break:
1. Every normalizer has its own fallback — unknown values default to "dialysis" sections. A renamed value would quietly be treated as dialysis.
2. PreSubmitChecklist and pcr-dropdowns treat transport=private_pay as "skip PCS / reduced fields". Removing it without a payer-based replacement makes self-pay trips suddenly fail readiness.
3. The claim trigger prices from payer; if the payer column moves before the trigger reads it, claims price at the $0 default rate (the original underbilling bug).
4. Enum value removal in Postgres is not possible in place (requires type recreation) — must be last.

## Recommended sequence (each stage independently shippable and reversible)

**Stage 0 — Single vocabulary module (code only, no schema).**
Add `src/lib/transport-vocabulary.ts` mirroring payer-vocabulary.ts: canonical keys `dialysis | ift | discharge | outpatient | wound_care | psych | emergency`, plus `normalizeTransportKey()` that maps every legacy spelling (woundcare, ift_general, ift_wound_care, nemt_dialysis, outpatient_specialty, ift_discharge, complex, hospital) and returns `null` (not "dialysis") for private_pay/unknown. Unit tests over every value found in live data. No behavior change yet.

**Stage 1 — Expand (additive migration).**
- New enum `transport_kind` with the 7 canonical values.
- Add nullable `transport_kind` to patients, scheduling_legs, trip_records; add `payer_class text` to trip_records and scheduling_legs (patients.primary_payer is already canonical).
- Old columns untouched. Nothing reads the new columns yet.

**Stage 2 — Backfill (data operation, logged).**
- Compute transport_kind from (pcr_type, trip_type, transport_type) with precedence: pcr_type='emergency' wins; else trip_type; else pcr_type mapping; else patient.transport_type.
- payer_class from normalizePayerKey rules (commercial -> private).
- private_pay-as-transport rows: payer_class := self_pay; transport_kind := the patient's other transport_type if set, else derived from destination facility type, else left NULL and listed in a review report (never guessed). Zero rows today, but the rule ships.
- Write a before/after snapshot to a backfill audit table; dry-run first and report counts for review before applying.

**Stage 3 — Dual-write.**
All writers set both old and new columns (patient form, one-off runs, trip creation, emergency upgrade, sim/loadtest functions). A small DB trigger keeps new columns filled from old ones if any writer is missed. Add a nightly mismatch check (old-derived vs new) surfaced to the creator.

**Stage 4 — Migrate readers, clinical first, behind parity checks.**
- usePCRSectionRules / pcr-field-requirements / PCRPage submit read transport_kind via the new module.
- Before switching each, run a parity test across all existing trips: required-section set from old path must equal new path. Any diff is reviewed, not shipped blind.
- Replace "transport = private_pay" logic with "payer = self_pay" in pcr-dropdowns, PreSubmitChecklist, section rules (private_pay rule column becomes a payer overlay).

**Stage 5 — Migrate billing readers.**
claim-readiness, queue submission, payer helpers read payer_class. Claim trigger switched last (see risks). Run claim-parity tests; existing claim totals for all trips must be unchanged on re-derivation.

**Stage 6 — UI.**
Patient form and one-off run form show Transport Type (7) and Payer (4) as separate choices; Private Pay removed from transport list. Billing intake fields keyed off payer; clinical intake fields keyed off transport type.

**Stage 7 — Contract (only after 2+ weeks of zero mismatches).**
Stop writing old columns, then drop/retire them; recreate trip_type enum without woundcare/private_pay. Keep pcr_type as a deprecated read-only column for one more cycle for audit/export history.

## Riskiest touch points and de-risking

| Risk | Mitigation |
|---|---|
| Claim trigger mis-prices (payer) or wrong HCPCS | Change trigger in its own migration; read `COALESCE(new.payer_class, old cascade)`; re-run claim-parity tests; compare totals on simulation company before real tenants; keep previous function body as `_BACKUP`. |
| ePCR required set silently changes (crew blocked or claims under-documented) | Parity test on every existing trip per stage; new normalizer returns null instead of defaulting to dialysis, and null shows a visible "transport type missing" blocker. |
| Self-pay trips start failing readiness when private_pay transport logic is removed | Add payer-based rule before removing transport-based rule (same release). |
| auto_flag_trip_qa trigger reads a type field | Update with dual read in Stage 4. |
| Enum shrink is irreversible | Last stage only, after mismatch monitor is clean. |
| Sim/loadtest/oatest functions seed old values | Update in Stage 3 so test data exercises the new path. |
| Multi-tenant leakage in backfill reports | Report queries scoped per company (creator view lists per company). |

## Out of scope
NEMSIS/CTA path and exporter (no reads of these fields by name); HCPCS/modifier derivation logic itself; charge master structure.

## Open decisions for you/owner
1. Should "outpatient" keep a separate "specialty" flavor, or one value? (Plan assumes one.)
2. Is emergency a transport type (Axis 1) or should it stay an upgrade flag (`is_emergency_pcr`)? Plan treats it as a transport type set by upgrade, keeping the flag for billing.
3. Commercial vs facility-contract: one "private" payer class (current) or split later? Plan keeps one.
