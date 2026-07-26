# End-to-End Flow Audit (Read-Only)

For each item: EXISTS / PARTIAL / DOES NOT EXIST, file evidence, required vs optional fields. Cited from current code — no changes made.

---

## 1. COMPANY SIGNUP — EXISTS
**UI:** `src/pages/CompanySignup.tsx` (4-step wizard: info → profile → agreements → confirm)
**Edge function:** `supabase/functions/company-signup/index.ts`

**Server-REQUIRED fields (edge function validates independently of UI):**
- `email`, `password`, `fullName`, `companyName` (`index.ts:33-38`)
- `npiNumber`, `stateOfOperation`, `serviceAreaType` (`:40-45`) — note: server only checks truthy, does NOT re-validate NPI 10-digit format
- `addressStreet`, `addressCity`, `addressZip` (5 digits, re-parsed server-side, `:47-54`)
- `einNumber` — 9 digits after stripping non-digits (`:56-64`)
- `agreements.terms_of_service`, `agreements.privacy_policy`, `agreements.hipaa_responsibilities` (`:66-71`)

**Client-only (never re-checked server-side):** payer mix totaling 100%, NPI Luhn/10-digit format, truckCount, currentSoftware, yearsInOperation, hasInhouseBiller, hipaaPrivacyOfficer, phone.

**DB rows created (all as service-role in one edge-function call):**
- `companies` (`onboarding_status: "pending_approval"`) — `:134-160`
- `company_memberships` (role=`owner`) — `:173`
- `profiles` — `:179`
- `company_settings` — `:185`
- `legal_acceptances` ×3 — `:190-197`
- `subscription_records` (status `pending_approval`, plan `poddispatch_standard`) — `:202-205`
- `migration_settings` (wizard_step 0) — `:207-210`
- `charge_master` seeded via `_shared/seed-charge-master.ts` (Medicare real rates for ZIP; 4 placeholder rows `needs_review=true`) — `:212-219`
- `onboarding_events` — `:221-226`
- Optional `notifications` to system_creators — `:228-256`

**Gate after signup:** Auto sign-in → redirect to `/pending-approval`. A system creator must approve before the app is usable. Approval mechanism (which edge function flips `companies.onboarding_status`) not traced in this audit — **open question**.

---

## 2. COMPANY / PROVIDER SETUP — PARTIAL
Fields captured at signup on `companies`: `npi_number, ein_number, state_of_operation, service_area_type, address_street, address_city, address_state, address_zip`.

**837P generator:** `src/lib/edi-837p-generator.ts` takes a pre-built `ProviderInfo` object requiring: `npi, tax_id, organization_name, address, city, state, zip, phone`. The generator is pure — the actual `companies`/`company_settings` → `ProviderInfo` mapping happens upstream in `EDIExport.tsx` / `queue-claims-for-submission.ts` and was NOT enumerated in this audit — **open question** (needs a follow-up read to list exact columns consumed).

**Billing readiness gates (referenced by `useOnboardingProgress.ts`, `BillingWorkQueue.tsx`, `BillingAndClaims.tsx`):**
- **Charge master "verify rates"** — expects all 5 payer types with `base_rate>0`, `mileage_rate>0`, `needs_review=false` (from memory `billing/auto-rate-seeding.md` + `features/onboarding-wizard-v2.md`).
- **Clearinghouse** — `clearinghouse_settings.is_configured = true` (Office Ally credentials, sender/receiver IDs, folders).
- Whether these are hard-blocks or soft-warnings inside `queueClaimsForSubmission` — **open question** (file only partially read).

---

## 3. FACILITIES — EXISTS
**File:** `src/pages/FacilitiesPage.tsx`, insert `:116` into `facilities` table.
**Client-required:** `name` (`:90`); if `facility_type === "dialysis"` then `dialysis_subtype` also required (`:94-97`, tied to EDI G/J modifier correctness).
**Optional in insert payload:** `address, phone, contact_name, notes, active, contract_payer_type, rate_type, invoice_preference, facility_type`.
Table not present in generated `types.ts` (cast `as any`) — DB-level NOT NULL constraints beyond `name`/`company_id` **could not be confirmed from source**.

---

## 4. CREW / EMPLOYEES — EXISTS
**File:** `src/pages/Employees.tsx` (invite flow preferred; legacy direct-create also exists).
**Invite flow:** inserts `profiles` placeholder with `invitation_status: "invited"`, `pending_role`, `email` (client-required, `:258-260`), `company_id`. Optional: `full_name, phone_number, sex, cert_level, employment_type, stair_chair_trained, bariatric_trained, oxygen_handling_trained, lift_assist_ok`. Then calls `send-employee-invite` edge function.

**Role enum mismatch:** DB `app_role` = `admin | crew | dispatcher | billing` (`types.ts:6748`); UI form uses `manager | dispatcher | crew | biller`. Either UI is stale or `profiles.pending_role` is a free-text column — **open question**.

**Are crew required for PCR?** `crew_certifications` tracks license expirations (`CrewCertificationsDialog.tsx`, `CertificationReviewQueue.tsx`), but nothing in the visible portion of `pcr-field-requirements.ts` gates PCR finalize on cert expiry. PCR does require `signatures_json` including a crew role signature (see item 8), so a signed-in crew user is functionally required to complete a PCR.

---

## 5. VEHICLES — EXISTS
**File:** `src/pages/TrucksCrews.tsx`, insert `:387` into `trucks`.
**Client-required:** `truckName` (`:377`). Optional: `vehicle_id`, `service_level` (default `BLS`).
**Server-enforced cap:** insert can fail with `TRUCK_CAP_EXCEEDED` (`:389-393`) — plan-based truck limit is DB/trigger enforced.
`is_simulated` on `trucks` **not confirmed in `types.ts`** (exists on patients/scheduling_legs) — **open question**.

---

## 6. PATIENTS — EXISTS
**File:** `src/pages/Patients.tsx`, insert `:654` into `patients`.
**DB-required (from `patients.Insert` in `types.ts`):** `company_id`, `first_name`, `last_name`. Everything else nullable.

**Insurance columns (all in `patients`):**
- Primary: `primary_payer` (string), `member_id`
- Secondary: `secondary_payer`, `secondary_payer_id`, `secondary_member_id`, `secondary_group_number`, `secondary_payer_phone`
- Tertiary: `tertiary_payer`, `tertiary_payer_id`, `tertiary_member_id`, `tertiary_group_number`, `tertiary_payer_phone`

There is NO boolean "is_medicare"/"is_medicaid" — payer type is inferred by string match on `primary_payer`/`secondary_payer` (e.g., `claim-readiness.ts` uses `payer_name.includes("medicare")`). For Medicare primary + Medicaid secondary: set `primary_payer="Medicare"` + `member_id`, `secondary_payer="Medicaid"` + `secondary_member_id`.

**PCS is captured on the PATIENT** (persistent): `pcs_on_file, pcs_physician_name, pcs_physician_npi, pcs_expiration_date, pcs_signed_date`. Per-trip override for one-off runs: `scheduling_legs.oneoff_pcs_obtained`.

---

## 7. SCHEDULING A TRIP / LEGS — EXISTS
**File:** `src/pages/Scheduling.tsx` + `useSchedulingStore`. Table: `scheduling_legs`.
**DB-required (Insert):** `company_id, destination_location, leg_type, pickup_location, run_date`. All other columns nullable/defaulted.

**A/B leg modeling:** `leg_type` enum with values `a_leg` / `b_leg` — round-trips are **TWO SEPARATE ROWS**, not a single row with a flag. Confirmed by `Patients.tsx:597-609` filters and auto-leg-generation memory. Recurring dialysis edits at patient level propagate to future `a_leg`/`b_leg` rows dated `>= today`.

**`trip_records` vs `scheduling_legs`:** `scheduling_legs` = schedule slot; `trip_records` = executed instance holding PCR data. Relationship: `trip_records.leg_id → scheduling_legs.id`.

One-off runs carry `oneoff_*` fields directly on the leg (name, dob, member_id, payer, addresses, `oneoff_pcs_obtained`) — these are DB-optional but UI-required in the one-off dialog.

---

## 8. PCR COMPLETION — EXISTS
**Files:** `src/pages/PCRPage.tsx`, `src/lib/pcr-field-requirements.ts` ("single source of truth"), `src/lib/claim-readiness.ts`.

**Required field groups (assembled per transport type in `REQUIREMENTS` map):**
- `TIMES_FIELDS` — dispatch, at-scene, patient-contact, left-scene, arrived-dropoff, in-service; `loaded_miles ≥ 0`; origin/destination facility type; odometer at scene & destination (0 valid)
- `VITALS_FIELDS` — at least one saved vitals set with timestamp
- `CONDITION_FIELDS` — LOC, skin condition, condition at destination
- `NECESSITY_FIELDS` — `medical_necessity_reason` + ≥1 of {bed_confined, cannot_transfer_safely, requires_monitoring, oxygen_during_transport}
- `STRETCHER_FIELDS`, `ISOLATION_FIELDS` (conditional)
- `SIGNATURE_FIELDS` + `CREW_SIGNATURE_FIELDS` — `signatures_json` non-empty, `signature_obtained=true`, crew role + patient role both present
- `NARRATIVE_FIELDS` — non-empty; **≥150 chars** for ambulance-level trips (`PCRPage.tsx:~1280`)
- `ASSESSMENT_FIELDS` — `chief_complaint`, `primary_impression`
- `ICD10_FIELD` — ≥1 code
- `SENDING_FACILITY_FIELDS` — for facility-origin trips: facility_name + pcs_attached
- Payer-specific augmentations (`PAYER_AUGMENTATIONS`) layered on top — full enumeration **open question** (only file lines 1-120 reviewed).

**Finalize gate (`PCRPage.tsx handleSubmit` `:1287-1310`):**
Blocks submit if `getMissingItems()` returns anything (QA-fix mode allows admin to skip "Crew Signatures"). On success updates `trip_records`:
- `pcr_status: "submitted"`
- `status: "ready_for_billing"`
- `claim_ready: true`
- `documentation_complete: true`

**Admins CANNOT sign for crew** — admin submit is rerouted to "kick back" (`pcr_status: "kicked_back"`, clears claim_ready). Enforced in UI only.

---

## 9. CLAIM GENERATION — EXISTS (DB trigger, not app code)
**Trigger:** `public.auto_create_claim_on_pcr_submit()` (`supabase/migrations/20260530125538_...sql:63+`)
**Fires:** `AFTER UPDATE ON trip_records` when `NEW.pcr_status = 'submitted'` AND value changed.

**So the trigger to generate a claim is simply the PCR finalize in item 8** — no separate button.

Trigger derives payer/member/charges from `patients` → falls back to `scheduling_legs.oneoff_*` → falls back to `trip_records`, looks up facility metadata for ambulance G/J/D modifiers, computes HCPCS + charges from a rate table, then:
```
INSERT INTO claim_records (...) VALUES (..., 'ready_to_bill', ...)
ON CONFLICT (trip_id) DO UPDATE ...
```
**Initial `claim_records.status = 'ready_to_bill'`**.

---

## 10. FINAL PRE-SUBMISSION STATE — where to STOP
- **Status:** `claim_records.status = 'ready_to_bill'`
- **Screen:** `src/pages/BillingAndClaims.tsx` — filtered list `.filter(c => c.status === "ready_to_bill")` (`:459`) plus per-claim detail panel with a confirm dialog "Submit this claim to Office Ally?" (`:2003`).
- **Send action:**
  - Group: "Send via OA" → `handleSendViaOA` (`:454-483`)
  - Single: submit button in detail panel (`:2000-2015`)
  Both call `queueClaimsForSubmission()` in `src/lib/queue-claims-for-submission.ts`, which builds the 837P via `generateEDI837P` and INSERTS a row into `claim_submission_queue`.
- **After that insert, a Railway SFTP worker (external to this repo, per file header comment) polls and transmits to Office Ally.** No outbound SFTP push exists in `supabase/functions/*` — only ack ingest / remittance / connection test.

**Your STOP point for a "generate but don't send" test:** verify the `claim_records` row appears in BillingAndClaims with status `ready_to_bill`, and do NOT click "Send via OA" or confirm the "Submit this claim to Office Ally?" dialog. Once a row lands in `claim_submission_queue`, the external worker may transmit on its next poll.

---

## Open Questions (would need a second read)
1. Which edge function flips `companies.onboarding_status` from `pending_approval` to active.
2. Exact `companies`/`company_settings` → `ProviderInfo` column mapping in `EDIExport.tsx` / `queue-claims-for-submission.ts`.
3. Whether `clearinghouse_settings.is_configured` and charge_master "verify rates" are hard blocks or soft warnings in `queueClaimsForSubmission`.
4. `facilities` DB-level NOT NULL constraints (table absent from generated types).
5. Employees UI role vocab (`manager/biller`) vs DB `app_role` enum (`admin/billing`) mismatch.
6. Whether expired crew certifications block PCR finalize (not seen in first 120 lines of `pcr-field-requirements.ts`).
7. Existence of `trucks.is_simulated`.
8. Full `PAYER_AUGMENTATIONS` list per payer type (lines 120-521 of `pcr-field-requirements.ts` not read).

---

**No code changes made. Audit only.**
