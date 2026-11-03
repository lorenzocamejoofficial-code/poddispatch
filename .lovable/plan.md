# Manual "Create ePCR" for owners/managers

## Answer to Question 1: where completed ePCRs live today

- **Sidebar:** the **Clinical** group, then **Trips & Clinical**, which goes to `/trips` and opens `src/pages/TripsAndClinical.tsx`. Owner, manager and billing can see it (`src/components/layout/AdminLayout.tsx` line 102). The page lists `trip_records` for the active company by date. It puts past incomplete PCRs at the top and shows status badges, including "PCR Submitted". There is no separate "completed PCR" page. Completed PCRs are trips whose status is `ready_for_billing`. Billing picks them up under **Billing → Billing & Claims** (`/billing`).
- **Table:** a PCR is not its own table. It is the `trip_records` row: about 179 columns of clinical fields, `pcr_status`, `pcr_type`/`trip_type`, `transport_kind`/`payer_class`, timestamps and signatures. Related tables are `trip_status_history`, `trip_events`, `document_attachments` and `qa_reviews`. When the PCR is submitted, the claim goes to `claim_records`.
- **Status flow:**
  1. Dispatch creates `scheduling_legs`, and Truck Builder puts them into `truck_run_slots` with a `crews` row for that truck and day.
  2. The crew opens `/pcr` (`src/pages/PCRPage.tsx`). The run picker (`PCRRunSelector`) lists today's slots. `createTripForRun` (lines 440–600) inserts the `trip_records` row with `status: scheduled`, `pcr_status: not_started`, leg/slot/truck/crew/patient, origin and destination types, service level, patient defaults and one-off leg data. It refuses dialysis runs that have no ICD-10 code.
  3. As the crew enters timestamps, the trip moves through en route, arrived at pickup, loaded, arrived at drop-off and completed. Meanwhile `pcr_status` goes `in_progress`, with `kicked_back` possible from QA.
  4. **Done:** Submit (PCRPage about line 1427) sets `pcr_status: submitted`, `status: ready_for_billing`, `pcr_completed_at`, `pcr_submitted_by`, `claim_ready` and `documentation_complete`. The `auto_create_claim_on_pcr_submit` database trigger then creates the claim, and `auto_flag_trip_qa` runs QA checks.

## Question 2: the plan

### Where it lives
A **"Create PCR"** button in the header of **Trips & Clinical** (`/trips`), shown to owners and managers only. It opens a setup dialog. When setup is done, the user goes to `/pcr?tripId=<new id>&mode=manual`.

### Setup step (dialog, all fields required unless marked)
1. **Patient:** a searchable list of the active company's patients. Selecting one shows their payer, DOB, standing ICD-10 codes and default addresses.
2. **Transport type:** the six transport kinds (dialysis, IFT, discharge, outpatient, wound care, psych). This defaults to the patient's own transport type.
3. **Run date and pickup time.** The date defaults to today and may be in the past for documenting a run late.
4. **Truck:** active trucks only. A truck that is down or out of service that day is blocked, using the existing availability check.
5. **Crew:** pick the crew already assigned to that truck for that date if one exists. Otherwise pick members 1, 2 and an optional 3 from employees. Members must pass the same certification check as assignment (`crew_assignable`, which includes the sandbox bypass).
6. **Pickup and destination:** these default from the patient or facility and stay editable. Leg A/B is the direction.
7. **Type-specific checks before the PCR opens**, the same ones the crew path runs:
   - A dialysis run needs a patient ICD-10 code.
   - Bariatric runs go through the safety rule check.
   - A run within 45 minutes of another run on the same truck gets a warning.
   - The intake rules already used for the patient and transport type apply.

### How the transport type sets the PCR type today
`createTripForRun` writes the run's `trip_type` into both `trip_type` and `pcr_type`. `pcr_type` is a deprecated copy. The database triggers fill in `transport_kind`. Required fields come from `pcr-field-requirements.ts` through `clinicalTransportType` / `normalizeTransportKey`. Emergency is an upgrade flag, not a type. The manual path writes the same legacy fields, so all of these keep working unchanged.

### Reuse vs. new
- **Reuse:**
  - the patient-defaults and ICD-10 logic in `createTripForRun`, moved into one shared helper both paths call
  - the full PCR form, the pre-submit checklist and the submit step
  - the claim trigger, QA trigger and status labels
  - the existing truck/crew safety, conflict and availability checks
  - active-company scoping
- **New:**
  - the `CreatePcrDialog` component
  - the shared `buildTripInsert()` helper, with tests
  - the owner/manager button
  - letting `/pcr` open in the office layout for a manually created trip

### Build approach
1. Move the trip-insert assembly out of `createTripForRun` into `src/lib/pcr-trip-insert.ts`, a pure function. The crew path calls it with no change in behavior. Add tests for patient defaults, dialysis ICD blocking and type mirroring.
2. Create a matching one-off `scheduling_legs` row (`is_unscheduled: true`) and a `crews` row if none exists. The trip then has a leg, truck and crew like every scheduled trip, and Scheduling, feasibility and claim payer lookup all see it.
3. Insert the `trip_records` row through the helper, with `pcr_status: not_started`, and open `/pcr?tripId=…`.
4. PCRPage: for office roles on a manual trip, use the office layout. Signatures and attending options come from the trip's crew members, as they do now.
5. Submit goes through the existing code, so downstream it is the same as a crew-completed PCR.

## Gotchas
- **PCRPage is crew-shaped.** It uses the crew layout. With no `tripId` it shows only the crew run picker, and the crew-handoff checks are skipped for non-crew users. Editing as an owner needs the office layout and needs to bypass the crew-only gates on purpose.
- **Truck check-off gate.** The crew path may require a submitted truck inspection before a PCR. For a manual or after-the-fact PCR, I assume we skip that gate and record that in the audit log. Please confirm.
- **Leg/slot dependence.** `trip_records.leg_id` is nullable, but Scheduling counts, feasibility, the claim payer fallback and duplicate detection all expect a leg. Creating the matching leg (step 2) avoids orphan behavior. The other option, trips with no leg, is riskier.
- **Duplicates.** Warn if the patient already has a trip on that date and leg. This reuses the existing duplicate warning in the run picker.
- **Attestation.** The PCR is still documented and signed as the chosen crew. The owner who created it is stored as `created_by` and in the audit log, so it is clear who entered it.
- **Scope.** This is not linked to NEMSIS/CTA work. Billing and claim logic do not change.

## Open questions (assumed answers in brackets)
- Should dispatchers also get the button? [No: owner and manager only, as you asked.]
- Skip the truck inspection gate for manual PCRs? [Yes, with an audit note.]
- Allow past dates? [Yes, up to 7 days back.]
