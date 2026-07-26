# AUDIT — Add Facility & Add Patient forms

Read-only. Evidence cited by file path + line. Only the save-blocking field is `Facility Name` (facilities) and `First Name`/`Last Name` (patients). Everything else is best-effort with soft toast warnings.

---

## 1. ADD FACILITY form
File: `src/pages/FacilitiesPage.tsx` (dialog @ 192–298, save handler @ 89–128)

Fields in order:

| # | Label | Type | Required to save | Notes |
|---|---|---|---|---|
| 1 | Facility Name * | text | **YES** — blocked at L90 with toast "Facility name required" | Trimmed |
| 2 | Type | select | no (defaults `dialysis`) | Options: `dialysis` (Dialysis), `hospital` (Hospital), `snf` (SNF / Nursing), `outpatient_specialty` (Outpatient Specialty), `assisted_living` (Assisted Living), `private_residence` (Private Residence) — L207-214 |
| 3 | Dialysis Subtype * | select | **YES if Type = dialysis** — blocked at L94-97 with toast "Dialysis subtype is required (hospital-based or freestanding)". Only shown when type is dialysis. | Options: `hospital_based` (Hospital-based (G)), `freestanding` (Freestanding (J)), `unknown` (Unknown (D)) — L225-227 |
| 4 | Address | text | no | |
| 5 | Phone | text | no | free-text, no format check |
| 6 | Contact Name | text | no | |
| 7 | Contract Payer Type | select | no | **Hidden when Type = dialysis** (L245). Options: `medicare`, `medicaid`, `facility` (Facility Contract), `cash`, `mixed` — L253-259 |
| 8 | Rate Type | select | no | Hidden for dialysis. Options: `medicare` (default), `contract`, `mixed` — L266-270 |
| 9 | Invoice Preference | select | no | Hidden for dialysis. Options: `per_trip` (default), `weekly`, `monthly` — L278-282 |
| 10 | Notes | textarea (2 rows) | no | |
| 11 | Active | checkbox | no (defaults true) | |

**Minimum to save:** Name (+ Dialysis Subtype if type=dialysis). Also inserts `company_id` from `get_my_company_id()` RPC (L100).

**To be selectable as a patient's Dropoff Facility:** `active = true` (default). The dropoff dropdown reads from `facilities` table filtered by `active=true`, ordered by `name`, and the value stored on the patient is the facility **name string**, not the id — see `src/components/patients/FacilityDropdown.tsx` L26-29 and L52 (`onChange(newName.trim())`). So the facility must be saved as active; the name string is what's persisted on the patient.

---

## 2. ADD PATIENT form
File: `src/pages/Patients.tsx` (dialog opens at L1054, save handler at L451–670)

**Hard save-blockers (only these cause save to fail silently or with error):**
- `first_name` — required, L543 `if (!payload.first_name || !payload.last_name) return;`
- `last_name` — required, same line

Everything else marked with `*` in the UI is a **soft required** — save proceeds and a toast warning lists missing fields (L546-554 via `getMissingPatientRequirements`). It does not block the DB insert.

### Fields in order

#### Identity
| # | Label | Type | Save-blocking? | Options / notes |
|---|---|---|---|---|
| 1 | First Name * | text | **YES** | L1082 |
| 2 | Last Name * | text | **YES** | L1083 |
| 3 | DOB | date (`<input type="date">`) | no (soft) | ISO `yyyy-mm-dd`; no past-date validation in save handler — L1086, L458 |
| 4 | Phone | text | no | free-text, no format check |
| 5 | Sex | radio (M/F/U) | no (soft) | Values: `M` Male, `F` Female, `U` Unknown — L1092 |
| 6 | Race | select | no | `American Indian or Alaska Native`, `Asian`, `Black or African American`, `Native Hawaiian or Other Pacific Islander`, `White`, `Other`, `Prefer not to say` (blank sentinel `unspecified`) — L1107-1113 |
| 7 | Ethnicity | select | no | `Hispanic or Latino`, `Not Hispanic or Latino`, `Prefer not to say` — L1123-1125 |

#### Location
| # | Label | Type | Save-blocking? | Options / notes |
|---|---|---|---|---|
| 8 | Pickup Address | text (single free-text) | no (soft) | Placeholder `"Street, City, ST ZIP"`. **Single freeform string**, not structured. No ZIP or format check. — L1130, L463 |
| 9 | Home Location Type | select | no | Options: `Residence`, `SNF`, `Assisted Living`, `Group Home`, `Other` — L1140-1144 |
| 10 | Facility (if applicable) | FacilitySelect | no | Only shown when Home Location Type ≠ Residence — L1148. Reads active facilities, stores facility **id** (`facility_id`) — `src/components/patients/FacilitySelect.tsx` |
| 11 | Dropoff Facility | FacilityDropdown (typeable + create-new) | no (soft) | Reads `facilities` where `active=true`. Stores the facility **name string** on `patients.dropoff_facility`, not the id. Includes "Create New Facility" option that opens quick-add dialog requiring name + dialysis subtype. — `src/components/patients/FacilityDropdown.tsx` |
| 12 | Weight (lbs) | number | no | ≥300 auto-sets `bariatric=true` — L1167 |
| 13 | Status | select | no (defaults `active`) | `active`, `in_hospital`, `out_of_hospital`, `vacation`, `paused` — L56-62 |
| 14 | Notes / Standing Instructions | textarea | no | |

#### Transport & Recurrence
| # | Label | Type | Save-blocking? | Options / notes |
|---|---|---|---|---|
| 15 | Transport Type | radio cards | no | Values: `dialysis`, `outpatient`, `wound_care`, `ift` (IFT (Inter-facility)), `discharge` (Hospital Discharge), `private_pay`, `psych_transport` (Psych / Behavioral Transport) — L80-88 |
| 16 | Schedule Days | select or day chips | no | **Dialysis only:** select `MWF` (Mon/Wed/Fri) or `TTS` (Tue/Thu/Sat) — L64-67. **All other transport types:** multi-select chips 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat (no Sun) — L69-76. Only shown when `isRepetitive`. |
| 17 | Chair Time / Appointment Time | time | no | dialysis: "Chair Time", others: "Appointment Time" |
| 18 | A-Leg Pickup Time | time | no | |
| 19 | Chair/Appt Duration (Hours + Minutes) | number pair | no | Hours 0-8, Minutes 0-59 |
| 20 | Recurrence Start Date | date | no | |
| 21 | End Date / No end date checkbox | date + checkbox | no | |
| — | Per-day schedule overrides | sub-component | no | Optional overrides per weekday |

#### Insurance & Transport
| # | Label | Type | Save-blocking? | Options / notes |
|---|---|---|---|---|
| 22 | Primary Payer | select | no (soft) | `medicare`, `medicaid`, `facility`, `cash` (Cash / Private) — L1366-1369. Stored lowercase (L483). |
| 23 | Member ID | text | no (soft) | Free-text. **No MBI format check, no length check.** — L1375, L485 |
| 24 | Secondary Payer | select | no | Same 4 values as Primary — L1391-1394. Collapsed by default. |
| 25 | Secondary Member ID | text | no | Free-text |
| 26 | Secondary Group Number | text | no | |
| 27 | Secondary Payer ID (EDI) | text | no | |
| 28 | Secondary Payer Phone | text | no | |
| 29 | Tertiary Payer + Member ID + Group + Payer ID + Phone | same as secondary | no | Same 4-value payer list — L1432-1435 |

#### Mobility / Operational
| # | Label | Type | Save-blocking? | Options / notes |
|---|---|---|---|---|
| 30 | Mobility | select | no (soft) | `ambulatory`, `wheelchair`, `stretcher`, `bedbound` — L1469-1472 |
| 31 | One-way Trips/Week Limit | number | no | |
| 32 | Stairs Required | select | no | `none`, `few_steps`, `full_flight` (auto-checks Stair Chair), `unknown` — L1492-1495 |
| 33 | Special Equipment | select | no | `none`, `bariatric_stretcher`, `extra_crew`, `lift_assist`, `other` — L1504-1508 |
| 34 | O₂ LPM | number (step 0.5) | no | |
| 35 | Stair Chair Required | checkbox | no | |
| 36 | Oxygen Required | checkbox | no | |
| 37 | Standing Physician Order on File | checkbox | no | |

Additional sections below (PCS, Prior Auth, Clinical Defaults, Hospice, ICD-10) exist further down the form — none are hard save-blockers; all funnel through the same soft-warning path.

### Validation summary
Client-side format constraints inspected in the save handler (L451-670): **none of the following are enforced.**
- DOB — accepts any date the picker allows; no past-date check.
- Pickup Address — free string; no ZIP/structure check.
- Member IDs (primary/secondary/tertiary) — free string; **no MBI/Medicaid format check.**
- Phone — free string; no length/format check.
- NPI on PCS physician — trimmed only.

The only real gate at save time is `first_name && last_name`. Missing "required" fields (sex, dob, pickup_address, dropoff_facility, primary_payer, member_id, mobility, transport-type-specific extras) trigger a yellow toast listing them but the row is still inserted.

---

STOP — report only, no changes made.
