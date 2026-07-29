# AUDIT — PCR Submit Requirements & Claim Pricing

Read-only. No changes.

---

## 1. SUBMIT GATE — what blocks `pcr_status='submitted'`

**File:** `src/pages/PCRPage.tsx` — `getMissingItems()` (lines 1252–1285) → `handleSubmit()` (lines 1287–1310).

The gate blocks submit when any of these are missing:

**A. Card-level rules (transport-driven)**
Iterates `cards`; for each `card` where `getEffectiveCardRule(card.type).state === "required"`, calls `isCardComplete(card)`. Required cards + fields come from `src/lib/pcr-field-requirements.ts` (`REQUIREMENTS[transportType]` + `PAYER_AUGMENTATIONS[payer]`).

**B. Hard-coded, all transports** (PCRPage.tsx 1260–1266)
- `trip.odometer_at_scene` — not null (0 is valid)
- `trip.odometer_at_destination` — not null (0 is valid)
- Crew signatures — `areAllCrewSigned(trip.signatures_json, assignedCrewCount)` where `assignedCrewCount` = count of non-null `crews.member1_id/2_id/3_id`. For a 1-person crew: **1** `type: "Crew Signature"` entry required (`src/components/pcr/CrewSignaturesSection.tsx:662`).

**C. Narrative length audit-defense** (PCRPage.tsx 1271–1283)
- Ambulance/stretcher transports (ift / emergency / dialysis / discharge / psych / wound, or `stretcher_placement` set): if `trip.narrative` is non-empty, must be ≥ **150 chars**. (Empty narrative is caught by NARRATIVE_FIELDS in the card rules.)

**D. QA fix mode exception** — if `isQaFixMode`, "Crew Signatures" is dropped from the missing list.

**Minimum required set (any transport):**
Times block (dispatch, at_scene, patient_contact, left_scene, arrived_dropoff, in_service), `origin_type`, `destination_type`, `odometer_at_scene`, `odometer_at_destination`, `loaded_miles` (≥ 0), signature(s), narrative (≥150 chars for ambulance transports).

Additional per-transport / per-payer requirements: `src/lib/pcr-field-requirements.ts` (`REQUIREMENTS` map + `PAYER_AUGMENTATIONS`). Also `src/lib/safety-rules.ts` → `getPcrRequiredFields()` gives a parallel per-PCR-type checklist (used by other UIs, not the submit gate directly).

---

## 2. MILEAGE — how loaded miles are captured

**Column that feeds the claim:** `trip_records.loaded_miles`.

**Capture path — `src/components/pcr/TimesCard.tsx`:**
- Manual entry field at line 426 → writes `loaded_miles` directly (line 430).
- Auto-compute at line 210: whenever both `odometer_at_scene` and `odometer_at_destination` are set,
  `updates.loaded_miles = parseFloat((destVal - sceneVal).toFixed(1))`.
  So odometer entries overwrite loaded_miles automatically.

**Downstream (claim):** `auto_create_claim_on_pcr_submit()` in `supabase/migrations/20260530125538_...sql:155`:
`v_mileage_charge := COALESCE(v_rate.mileage_rate, 0) * COALESCE(NEW.loaded_miles, 0);`
Also copied to `claim_records.mileage_charge` + emitted on 837P SV1 via `src/lib/edi-837p-generator.ts`.

---

## 3. DIALYSIS-SPECIFIC REQUIRED FIELDS (BLS, Medicare)

Base list — `src/lib/pcr-field-requirements.ts:232-242` (`REQUIREMENTS.dialysis`):

| Section | Fields |
|---|---|
| Times | dispatch_time, at_scene_time, patient_contact_time, left_scene_time, arrived_dropoff_at, in_service_time, loaded_miles, origin_type, destination_type, odometer_at_scene, odometer_at_destination |
| Vitals | ≥1 saved vitals set (timestamp + saved) |
| Condition on Arrival | level_of_consciousness, skin_condition, condition_at_destination |
| Medical Necessity | medical_necessity_reason **plus** ≥1 checklist item (bed_confined, cannot_transfer_safely, requires_monitoring, oxygen_during_transport) |
| Stretcher/Mobility | stretcher_placement, patient_mobility, patient_position |
| Isolation | isolation_status |
| Signature | crew signature(s) matching crew count |
| Narrative | non-empty + ≥150 chars |
| Assessment | chief_complaint |

**Medicare augmentation** (PAYER_AUGMENTATIONS.medicare in same file) adds — verify at lines ~340–400: PCS on file, ICD-10 codes (N18.6 / Z99.2 for ESRD), medical necessity notes. Also `getPcrRequiredFields('dialysis')` in `src/lib/safety-rules.ts:218-225` lists: pcs_attached, necessity_checklist, necessity_notes, icd10_codes.

**Not enforced by submit gate but consumed by claim:** `patients.pcs_on_file`, `patients.member_id`, `patients.primary_payer` (read by claim trigger — trip won't be denied on submit if missing, but the claim will fail Medicare).

---

## 4. SIGNATURE — 1-person crew

**Predicate:** `areAllCrewSigned(signaturesJson, assignedCrewCount)` in `src/components/pcr/CrewSignaturesSection.tsx:662`:
```
crewSigs = signaturesJson.filter(s => s.type === "Crew Signature");
return crewSigs.length >= assignedCrewCount;
```
For a solo Member 1: **exactly one** entry in `trip_records.signatures_json` with `type: "Crew Signature"` (also carries `signer_name`, `signer_role`, `png` data URL, `timestamp`, `crew_member_id`).

**Where entered:** PCR → **Signatures** card (`SignaturesCard` + `CrewSignaturesSection`, PCRPage.tsx:1222). The attending medic taps their slot, opens the full-screen signature pad, and signs. Written via `updateField("signatures_json", [...existing, newSig])` at CrewSignaturesSection.tsx:510-511.

Patient/guardian/facility signatures are separate entries in the same array but are **not** required by the submit gate — only `type: "Crew Signature"` entries are counted.

---

## 5. CLAIM PRICING INPUTS

**Function:** `public.auto_create_claim_on_pcr_submit()` — current def `supabase/migrations/20260530125538_7d63556b-…sql`.

**Rate lookup (lines 143–151):**
```sql
SELECT * INTO v_rate FROM public.charge_master cm
 WHERE cm.company_id = NEW.company_id
   AND lower(cm.payer_type) = v_payer_type
 ORDER BY cm.updated_at DESC NULLS LAST LIMIT 1;
-- fallback to payer_type='default' if none
```
**Rate is looked up by `company_id` + `payer_type`, NOT by ZIP.** ZIPs (`origin_zip`, `dest_zip`) are extracted from the address strings (lines 114–115) and stored on `claim_records` for the 837P, but they do not drive the base/mileage rate at claim-creation time.

**Pricing math (lines 154–156):**
```
v_base_charge    = charge_master.base_rate                       -- for the payer
v_mileage_charge = charge_master.mileage_rate * trip.loaded_miles
v_total_charge   = base + mileage + extras                       -- extras currently 0
```

**Payer resolution order (lines 92–110):**
1. `patients.primary_payer` (+ `patients.member_id`, `patients.pcs_on_file`, `patients.bariatric`)
2. If null and `leg_id` present: `scheduling_legs.oneoff_primary_payer` / `oneoff_member_id`
3. Overrides on trip: `trip_records.member_id`, `trip_records.primary_payer`
4. Fallback: `'default'` (lowercased, trimmed)

**HCPCS + modifiers (lines 138–141):**
- HCPCS from `derive_ambulance_hcpcs(service_level, is_emergency_pcr)` — e.g. BLS non-emergency → **A0428**.
- Modifier letters from `derive_ambulance_modifier_letter(origin_type/destination_type, facility_type, dialysis_subtype)`. Concatenated to a single pair (e.g. `RG`, `NJ`, `RH`).
- Mileage HCPCS **A0425** is added by the EDI generator, not the trigger.

---

### Confirming your "30076 urban base $293.50 / $9.33/mi"

That's the **CMS Ambulance Fee Schedule** value for A0428 base and A0425 mileage in Georgia locality 30076. In this system:

- Those raw CMS values live in `public.cms_ambulance_fee_schedule` (columns `urban_rate`, `rural_rate`, etc.) keyed by `carrier` + `locality`.
- The ZIP→locality mapping lives in `public.cms_zip_locality`.
- They are consumed **at company signup / charge-master seeding**, not at claim creation. See `supabase/functions/_shared/seed-charge-master.ts` — it calls `lookupCmsRates(zip5)`, joins `cms_zip_locality` → `cms_ambulance_fee_schedule`, and writes the Medicare row's `base_rate` and `mileage_rate` into `charge_master` for that company.
- At claim time the trigger reads that already-seeded `charge_master.base_rate` / `mileage_rate` row for `payer_type='medicare'`.

**So confirmation:** the $293.50 / $9.33 figures are correct for that locality, but they are baked into `charge_master` at seed time; the claim trigger does not re-derive them from ZIP. If a company's ZIP wasn't in `cms_zip_locality` at signup, `charge_master.medicare` was inserted with `needs_review=true` and 0 rates until the owner confirms — and the claim would price at $0 base until fixed.

---

## Files referenced

- `src/pages/PCRPage.tsx:1252-1310` (submit gate, handleSubmit)
- `src/lib/pcr-field-requirements.ts:34-46, 232-242, PAYER_AUGMENTATIONS` (per-transport / per-payer required fields)
- `src/lib/safety-rules.ts:218-225` (dialysis checklist)
- `src/components/pcr/TimesCard.tsx:210, 426-430` (loaded_miles capture + auto-compute)
- `src/components/pcr/CrewSignaturesSection.tsx:510-511, 662` (signature write + gate)
- `supabase/migrations/20260530125538_7d63556b-…sql:56-200` (auto_create_claim_on_pcr_submit — current def)
- `supabase/functions/_shared/seed-charge-master.ts` (CMS ZIP→locality→rate at signup)
- Tables: `charge_master`, `cms_ambulance_fee_schedule`, `cms_zip_locality`, `trip_records.loaded_miles`, `trip_records.signatures_json`.
