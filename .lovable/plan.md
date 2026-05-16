
# NEMSIS 3.5 Alignment — Phase 1 Planning Doc

Goal: replace the improvised `CHIEF_COMPLAINTS` and `PRIMARY_IMPRESSIONS` lists in `src/lib/pcr-dropdowns.ts` with NEMSIS 3.5 eSituation.09 / eSituation.11 aligned values, plus per-transport-type defaults and ICD-10 auto-population. No code changes in this phase.

---

## 1. Proposed Chief Complaint List (eSituation.09 aligned)

Grouped by NEMSIS Parent Code. Display format keeps the parent as a visual group label and stores the leaf string as the value (string-compatible with existing column, no schema change).

```
CARDIOVASCULAR
  Chest Pain / Discomfort
  Palpitations
  Cardiac Arrest
  Hypertension
  Hypotension / Shock
  Edema (Peripheral)

RESPIRATORY
  Breathing Difficulty / Dyspnea
  Respiratory Distress
  Respiratory Arrest
  Cough
  Tracheostomy Concern
  Airway Obstruction

NEUROLOGICAL
  Altered Mental Status
  CVA / Stroke Symptoms
  Seizure
  Syncope / Near Syncope
  Headache
  Dizziness / Vertigo
  Weakness (Extremity / Focal)

MUSCULOSKELETAL
  Back Pain
  Extremity Pain
  Joint Pain / Swelling
  Post-Operative Orthopedic Recovery

GI / ABDOMINAL
  Abdominal Pain
  Nausea / Vomiting
  GI Bleeding
  Constipation / Obstipation
  Diarrhea

GU / RENAL
  ESRD — Scheduled Dialysis Transport
  Urinary Retention
  Catheter / Urostomy Concern
  Hematuria

BEHAVIORAL / PSYCHIATRIC
  Behavioral / Psychiatric Emergency
  Involuntary Psychiatric Hold Transport
  Suicidal Ideation
  Agitation / Combative Behavior
  Substance Intoxication / Withdrawal

ENDOCRINE
  Hyperglycemia
  Hypoglycemia
  Diabetic Routine Care Transport

ENVIRONMENTAL
  Hypothermia / Cold Exposure
  Hyperthermia / Heat Exposure
  Drowning / Submersion

INFECTIOUS DISEASE
  Sepsis / Suspected Infection
  Fever
  Isolation Transport (known infectious precaution)

PAIN (when not classified elsewhere)
  Generalized Pain — specify location

SENSORY
  Visual Disturbance
  Hearing Loss / Tinnitus

SKIN / WOUND
  Wound Check / Dressing Change
  Active Wound — Drainage / Vac
  Pressure Ulcer Care
  Burn Care
  Rash / Skin Eruption

TRAUMA
  Fall — With Injury
  Fall — Without Injury
  MVC / Trauma
  Penetrating Trauma
  Assault

GENERAL / SYSTEMIC
  General Weakness / Debility
  Hospice / Palliative Transport
  Oncology Transport
  Post-Op Recovery Transport
  Bariatric Transport
  No Complaint — Routine Transport
  Transfer — No Acute Complaint

OTHER
  Other (free text)
```

---

## 2. Proposed Primary Impression List (eSituation.11 aligned)

Working clinical impression. Same 17 parents, clinician-language leaves.

```
CARDIOVASCULAR
  Hypertension — Stable
  Heart Failure / CHF
  Atrial Fibrillation / Dysrhythmia
  Acute Coronary Syndrome (suspected)
  Cardiac Arrest
  Cardiovascular — Stable for Transport

RESPIRATORY
  COPD / Asthma — Stable
  COPD / Asthma — Exacerbation
  Respiratory Failure
  Tracheostomy — Stable
  Ventilator Dependent — Stable

NEUROLOGICAL
  CVA / TIA
  Seizure Disorder
  Dementia / Cognitive Impairment — Baseline
  Altered Mental Status
  Syncope
  Neurological — Stable

MUSCULOSKELETAL
  Post-Operative Orthopedic — Stable
  Chronic Musculoskeletal Pain
  Hip / Femur Fracture — Post Stabilization
  Joint Replacement Aftercare

GI / ABDOMINAL
  GI Bleed
  Bowel Obstruction
  Abdominal Pain — Undifferentiated
  GI — Stable

GU / RENAL
  ESRD on Dialysis
  Acute Kidney Injury
  Urinary Retention / Catheter Care
  GU — Stable

BEHAVIORAL / PSYCHIATRIC
  Acute Psychosis
  Suicidal Ideation
  Homicidal Ideation
  Manic Episode
  Acute Anxiety / Panic
  Substance Intoxication
  Substance Withdrawal
  Behavioral Agitation
  Depression with Functional Impairment
  Psychiatric — Stable

ENDOCRINE
  Diabetes — Controlled
  Diabetes — Uncontrolled (Hyper/Hypoglycemia)
  Endocrine — Stable

ENVIRONMENTAL
  Hypothermia
  Hyperthermia

INFECTIOUS DISEASE
  Sepsis
  Active Infection (Pneumonia / UTI / Cellulitis)
  Isolation Precautions — Stable

PAIN
  Pain — Acute
  Pain — Chronic

SENSORY
  Sensory — Stable

SKIN / WOUND
  Chronic Wound Care
  Pressure Ulcer (specify stage)
  Surgical Wound — Healing
  Burn

TRAUMA
  Trauma — Minor
  Trauma — Significant
  Post-Trauma Stable

GENERAL / SYSTEMIC
  Oncology — Active Treatment
  Hospice / Palliative
  General Debility / Deconditioned
  Bariatric — Stable
  Transfer — No Acute Complaint
  No Acute Findings — Routine Transport

OTHER
  Other (free text)
```

`PSYCH_PRIMARY_IMPRESSIONS` (the legacy psych add-on list) is now fully subsumed by the Behavioral / Psychiatric parent — Phase 2 should delete that constant and have `AssessmentCards` always use the new unified list.

---

## 3. Per-Transport-Type Defaults

| transport_type | Default Primary Impression | Default Chief Complaint | Default ICD-10 (auto-populate, editable) |
|---|---|---|---|
| `dialysis` | ESRD on Dialysis | ESRD — Scheduled Dialysis Transport | Z99.2, N18.6 |
| `wound_care` | Chronic Wound Care | Wound Check / Dressing Change | L97.909, L89.90 |
| `psych_transport` | Psychiatric — Stable | Behavioral / Psychiatric Emergency | F20.9, F32.9 |
| `ift` | Transfer — No Acute Complaint | Transfer — No Acute Complaint | Z09 |
| `discharge` | No Acute Findings — Routine Transport | No Complaint — Routine Transport | Z09, Z51.89 |
| `outpatient` | No Acute Findings — Routine Transport | No Complaint — Routine Transport | Z09 |
| `bariatric` | Bariatric — Stable | Bariatric Transport | E66.01, Z68.45 |
| `als_non_emergency` | Cardiovascular — Stable for Transport | General Weakness / Debility | R53.1, I50.9 |

Architectural note: defaults currently live in two seams already — `patients.default_chief_complaint/default_primary_impression` (per-patient override) and `simulation-lab` / `oatest-run` fallbacks (hardcoded strings). Phase 2 should add a central `TRANSPORT_TYPE_DEFAULTS` map in `pcr-dropdowns.ts` and consume it both in `Patients.tsx` (auto-fill on transport_type change when default fields are blank) and in `PCRPage.tsx` pre-fill logic (lines 423–424) as the final fallback when patient template is blank.

ICD-10 auto-populate is new behavior. Cleanest seam: when `Patients.tsx` save runs, if `icd10_codes` is empty AND transport_type matches, seed with the table above. Or do it at PCR creation in `PCRPage.tsx` after patient pre-fill if `insertData.icd10_codes` is still empty. Recommend the PCR-creation seam — keeps patient table sparse and lets the user pre-set their own per-patient ICDs.

---

## 4. Translation Map (8 existing patients)

From the prior audit, current values present in DB:

**Chief Complaint:**
| Old value | New value |
|---|---|
| Breathing Difficulty / Dyspnea | Breathing Difficulty / Dyspnea *(unchanged)* |
| Extremity Weakness | Weakness (Extremity / Focal) |
| Fall / Injury | Fall — With Injury |
| General Weakness | General Weakness / Debility |
| Involuntary Psychiatric Hold Transport | Involuntary Psychiatric Hold Transport *(unchanged)* |
| Oncology Transport | Oncology Transport *(unchanged)* |
| Respiratory Distress | Respiratory Distress *(unchanged)* |
| Wound Check / Dressing Change | Wound Check / Dressing Change *(unchanged)* |

**Primary Impression:**
| Old value | New value |
|---|---|
| Renal — ESRD on Dialysis | ESRD on Dialysis |
| Cardiovascular — Stable | Cardiovascular — Stable for Transport |
| Oncology — Active Treatment | Oncology — Active Treatment *(unchanged)* |
| Psychiatric — Stable | Psychiatric — Stable *(unchanged)* |
| Trauma — Significant | Trauma — Significant *(unchanged)* |
| Wound Care — Chronic Wound | Chronic Wound Care |

Recommended approach: option (b) from prior audit — one-time data migration translating the 8 rows. Tiny table, zero ambiguity, and avoids the "old value shows as empty in Select" trap.

---

## 5. Files that read/write CHIEF_COMPLAINTS / PRIMARY_IMPRESSIONS (or their stored values)

**Imports the constants directly:**
- `src/lib/pcr-dropdowns.ts` — source of truth (also exports `PSYCH_PRIMARY_IMPRESSIONS`)
- `src/components/pcr/AssessmentCards.tsx` — renders both Selects in PCR; merges PSYCH list when `isPsych`
- `src/pages/Patients.tsx` — renders both Selects in patient form (lines 1195, 1209)

**Reads/writes the stored string column (no constant import, just consumes the value):**
- `src/pages/PCRPage.tsx` — pre-fills `chief_complaint` / `primary_impression` from patient defaults (lines 388, 423–424); section gating (1036–1132)
- `src/pages/EDIExport.tsx` — copies `chief_complaint` / `primary_impression` into `claim_records` (lines 455–460, 727–728)
- `src/lib/edi-837p-generator.ts` — builds NTE segment: `DISPATCH: <chief_complaint>` / `IMPRESSION: <primary_impression>` (lines 554–558)
- `src/components/pcr/NarrativeCard.tsx` → `src/lib/pcr-narrative.ts` — interpolates both strings verbatim into the narrative
- `src/components/pcr/FacilityCards.tsx` — `hospital_outcome_json.chief_complaint` (separate field, unrelated to dropdown but shares the name)
- `src/lib/safety-rules.ts` — required-field check by name only (lines 230, 231, 251, 265, 266, 275, 276)
- `src/lib/pcr-field-requirements.ts` — same (lines 105–106 + filters)
- `src/hooks/usePCRSectionRules.ts` — required-field check by name only
- `src/hooks/usePCRData.ts` — TypeScript type only
- `src/components/pcr/ICD10Picker.tsx` — keyword matcher (see §6)
- `supabase/functions/simulation-lab/index.ts` — fallback strings when seeding (lines 792–793: `"ESRD requiring dialysis"`, `"Stable for transport"`)
- `supabase/functions/oatest-run/index.ts` — fallback strings (lines 297–298: `"OATEST chief complaint"`, `"OATEST impression"`)

**ICD10Picker — current keyword/substring rules (`COMPLAINT_SUGGESTIONS` lowercase keys):**
```
"no complaint (routine transport)"       → Z09, Z51.89, Z87.39
"transfer / no complaint"                → Z09, Z51.89, Z87.39
"extremity weakness"                     → R53.1, M62.50, R26.89, G81.90
"general weakness"                       → R53.1, M62.50, R26.89, G81.90
"cva / stroke symptoms"                  → I63.9, I69.351, G81.90
"chest pain"                             → I50.9, I25.10, I10
"breathing difficulty / dyspnea"         → J44.1, J44.0, J96.00
"respiratory distress"                   → J44.1, J44.0, J96.00
"hyperglycemia / hypoglycemia"           → E11.65, E11.9, E10.9
"fall / injury"                          → S72.001A, M54.5, R26.89
"pain — specify location"                → M54.5, M16.11, M17.11, R26.89
"back pain"                              → M54.5, M16.11, M17.11, R26.89
"seizure"                                → G20, G35, F20.9
"altered mental status"                  → R41.3, G30.9, F03.90
```
Plus substring matches:
- complaint contains `"dialysis"` OR `"renal"` OR payer contains `"dialysis"` → adds Z99.2, N18.6, N18.5

**Keyword preservation required in Phase 2 — must add new keys and keep the substring rules. Concretely:**
| New chief complaint | New ICD suggestion key (must add) |
|---|---|
| `Weakness (Extremity / Focal)` | reuse R53.1, M62.50, R26.89, G81.90 |
| `General Weakness / Debility` | reuse R53.1, M62.50, R26.89, G81.90 |
| `Fall — With Injury` | reuse S72.001A, M54.5, R26.89 |
| `ESRD — Scheduled Dialysis Transport` | already hit by `"dialysis"` substring ✓ |
| `Transfer — No Acute Complaint` | reuse Z09, Z51.89, Z87.39 |
| `No Complaint — Routine Transport` | reuse Z09, Z51.89, Z87.39 |
| `Hyperglycemia` / `Hypoglycemia` (split) | reuse E11.65, E11.9, E10.9 |
| `Generalized Pain — specify location` | reuse pain set |

Substring rule for `"dialysis"` / `"renal"` survives unchanged. The `"chronic wound"` substring is not in the matcher today — Phase 2 could optionally add `"wound"` → L97.909, L89.90 to bring the wound_care default into the picker.

---

## 6. String Consistency Risk

Source-of-truth in `pcr-dropdowns.ts` propagates to all UI consumers via import, but there are **5 places that compare or emit the raw string** and can silently break if vocabulary changes:

1. **EDI NTE segments** (`edi-837p-generator.ts:554–558`) — emits the stored string verbatim into the 837P. New strings are still valid free text in NTE02 (up to 264 chars) — no break, but payers will see new vocabulary on submissions starting day 1.
2. **Narrative generator** (`pcr-narrative.ts` via `NarrativeCard`) — interpolates strings verbatim. New strings work, but any prose templates that pattern-match (e.g. `"if chief contains 'dialysis'"`) would need review. Quick grep needed in Phase 2.
3. **`ICD10Picker.COMPLAINT_SUGGESTIONS`** — hardcoded lowercase keys (covered in §5). Hard break if old keys removed without adding new keys.
4. **`simulation-lab/index.ts` fallback strings** (lines 792–793) — `"ESRD requiring dialysis"` is NOT in either old or new list. It's a non-canonical fallback. Should be replaced with canonical new values: `"ESRD — Scheduled Dialysis Transport"` / `"ESRD on Dialysis"`.
5. **`oatest-run/index.ts` fallbacks** (lines 297–298) — `"OATEST chief complaint"` / `"OATEST impression"` are placeholder strings, never matched anywhere. Cosmetic only, but should be brought to canonical values for realism in test runs.

**Zero orphaned hardcoded strings in `safety-rules.ts`, `pcr-field-requirements.ts`, `usePCRSectionRules.ts`** — those reference the column name `chief_complaint` / `primary_impression`, not the values. Safe.

**`FacilityCards.tsx` line 160** uses `hospital_outcome_json.chief_complaint` — that's a DIFFERENT field (free-text input on hospital outcome card). Confusingly named, but unaffected.

---

## 7. Phase 2 LOC Estimate & Architectural Decisions

**LOC estimate:** ~250–320 lines net change across these files:

| File | Lines | What |
|---|---|---|
| `src/lib/pcr-dropdowns.ts` | ~150 | Replace `CHIEF_COMPLAINTS`, `PRIMARY_IMPRESSIONS`, delete `PSYCH_PRIMARY_IMPRESSIONS`, add `TRANSPORT_TYPE_DEFAULTS` map |
| `src/components/pcr/ICD10Picker.tsx` | ~30 | Add new chief complaint keys to `COMPLAINT_SUGGESTIONS`, add `wound` substring rule |
| `src/components/pcr/AssessmentCards.tsx` | ~15 | Remove psych-merge branch, add optgroup rendering for parent labels in `<Select>` |
| `src/pages/Patients.tsx` | ~25 | Same optgroup rendering; auto-fill defaults when transport_type changes and fields are blank |
| `src/pages/PCRPage.tsx` | ~10 | Use `TRANSPORT_TYPE_DEFAULTS` as final fallback in pre-fill block (lines 423–424); auto-seed ICDs |
| `supabase/functions/simulation-lab/index.ts` | ~4 | Replace fallback strings with canonical values from new list |
| `supabase/functions/oatest-run/index.ts` | ~4 | Same |
| Migration SQL | ~30 | UPDATE 8 patient rows per §4 translation map |

**Architectural decisions you need to make before Phase 2:**

1. **Render parent groups in `<Select>` or flat list?** — shadcn `<Select>` doesn't natively support optgroup. Choices: (a) flat with `— PARENT —` divider items (disabled), (b) switch to `<Command>` / combobox with sections, (c) keep flat alphabetical and rely on display labels. Recommend (a) — minimal lift, zero new components.

2. **Where do `TRANSPORT_TYPE_DEFAULTS` get applied?** — three candidate seams:
   - Patients.tsx save handler (writes to patient row)
   - PCRPage.tsx pre-fill block (writes to trip on create)
   - Both (patient-level template, trip-level fallback)
   Recommend: **both, layered** — Patients.tsx auto-fills the form when transport_type changes AND the default field is blank (user can still override); PCRPage.tsx falls back to transport-type default only if the patient template is also blank. This matches existing layering.

3. **ICD-10 auto-population timing** — Do we auto-seed on PCR create only, or also retroactively suggest on existing PCRs with blank codes? Recommend create-time only; retroactive auto-write would silently mutate billing records.

4. **Free-text "Other" handling** — current code stores `"Other"` and renders a textarea for `assessment_json.chief_complaint_other`. Keep this pattern — it's NEMSIS-compatible (each parent has a "Not Listed" leaf).

5. **Backward compatibility for the 8 existing rows** — must run migration §4 BEFORE deploying the new list, otherwise the patient form's `<Select value={...}>` will show blank for migrated patients with old strings.

6. **`PSYCH_PRIMARY_IMPRESSIONS` deletion** — verify no external references (none found in this audit, but Phase 2 should re-grep before deleting).

7. **EDI submission cutover** — first claim batch after the change will introduce new vocabulary in NTE segments. No payer-side rule should break (free-text field), but worth flagging for the biller in the release notes.

---

## Out of Scope for Phase 1
- No code edits
- No schema migration
- No data updates
- No changes to PCR section rules / safety rules / field requirements (those reference column names, not values)

Ready for your go-ahead on Phase 2 once you've reviewed the lists in §1–§3 and answered the architectural questions in §7.
