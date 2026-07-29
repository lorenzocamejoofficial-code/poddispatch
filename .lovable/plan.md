# Scheduling → Leg → Trip → PCR — Audit (no changes)

## 1. Dispatcher scheduling UI (A-leg / B-leg)

- **Main page:** `src/pages/Scheduling.tsx`
  - Create A-leg / B-leg dialog for a known patient: `handleCreateLeg` around line 641 (`supabase.from("scheduling_legs").insert(...)`).
  - Same dialog has a **"This run needs a B-leg"** toggle (`needs_b_leg`, lines ~1660 and ~1797). When on, a second `scheduling_legs` insert runs immediately after the A-leg insert with `leg_type: "B"`, swapped pickup/destination, and a B-leg pickup time (lines ~568 and ~660).
  - One-off (non-recurring patient) A/B legs: `handleCreateOneoffLeg` around line 523 — same pattern, plus optional B-leg block at line 568.
  - Per-day exception editor (change pickup for a single date on a recurring patient) is also on this page around line 743; it validates B-leg-too-early via `src/lib/dialysis-validation.ts` and requires a dispatcher override reason.
- **Supporting components** used by the page:
  - `src/components/scheduling/RunPool.tsx`, `TruckBuilder.tsx`, `TemplateControls.tsx`, `UpcomingNonDialysisPanel.tsx` (assign legs to trucks/slots, apply templates).
- **Round-trip model:** a round trip is **two separate rows** in `scheduling_legs` — one row with `leg_type = "A"`, another with `leg_type = "B"`. They're linked only implicitly via `patient_id + run_date`. There is no `round_trip_id` grouping column.

## 2. Recurrence (MWF / TTS standing orders)

- **Patient recurrence config UI:** `src/pages/Patients.tsx`
  - Fields on the patient form: `schedule_days` ("MWF" | "TTS"), `recurrence_days`, `recurrence_start_date`, `recurrence_end_date`, `chair_time`, `chair_time_duration_hours/minutes`, plus per-weekday overrides via `src/components/patients/PatientScheduleOverridesEditor.tsx` (table `patient_schedule_overrides`).
  - Saving the patient does **not** create legs directly. It only stores the recurrence pattern on `patients`. If the patient's recurrence/duration changes, `Patients.tsx` ~line 612 propagates edits into **already-generated future legs** (updates existing A/B rows dated ≥ today) — it does not create new ones from scratch.
- **Expansion / auto-generate (the real recurrence engine):**
  - File: `src/hooks/useSchedulingStore.tsx`
  - Function: the `autoGenerate` callback, roughly lines 300–430.
  - Flow: for the currently `selectedDate`, it filters `patients` by `matchesScheduleDay(selectedDate, schedule_days, recurrence_days)` (helper at line 90) and `recurrence_start_date` / `recurrence_end_date`, checks which patients already have legs that day (line 331 query), then bulk-inserts the missing A and/or B rows into `scheduling_legs` (single `insert(newLegs)` at line 422).
  - It is **date-scoped and dispatcher-triggered** — invoked from `src/pages/Scheduling.tsx` (the "Generate A & B legs" button around line 700). There is no cron/edge function that expands recurrences ahead of time; each day is materialized when the dispatcher opens/generates that date.
  - Per-day overrides from `patient_schedule_overrides` are applied inside the same function (chair_time and treatment duration).

## 3. Data model

- **`scheduling_legs`** — the scheduled run. One row per leg. Key columns used: `patient_id`, `leg_type` ("A" | "B"), `run_date`, `pickup_time`, `chair_time`, `pickup_location`, `destination_location`, `trip_type`, `origin_type`, `destination_type`, `service_level`, `is_oneoff` + `oneoff_*` fields for ad-hoc/unknown patients, `company_id`. Inserts happen in exactly three places:
  - `src/pages/Scheduling.tsx` (manual A/B create, one-off create, per-day exception).
  - `src/hooks/useSchedulingStore.tsx` `autoGenerate` (recurrence expansion).
  - `src/pages/Patients.tsx` (updates only, not inserts).
- **`truck_run_slots`** — assignment of a leg to a truck for a given `run_date` (`leg_id`, `truck_id`, `run_date`, `slot_order`). Written by `TruckBuilder` / `RunPool`.
- **`trip_records`** — the operational/clinical record. `leg_id` is a **unique FK** back to `scheduling_legs`; a UNIQUE constraint enforces one trip per leg (see the collision handler at `src/pages/PCRPage.tsx` line 550 comment). Populated by `createTripForRun` in `PCRPage.tsx` line 412 and by `syncSlotsToTrips` in `src/pages/TripsAndClinical.tsx` line 262 — both copy `service_level / origin_type / destination_type / is_unscheduled` from the leg per the "Transport Context Cascading" memory.
- **`claim_records`** — auto-created on PCR submit by DB trigger `auto_create_claim_on_pcr_submit` (referenced in `src/pages/EDIExport.tsx` ~line 479, `BillingAndClaims.tsx` ~line 653).

So the chain is: `patients` (recurrence config) → `scheduling_legs` (one row per leg, materialized per date) → `truck_run_slots` (truck assignment) → `trip_records` (leg_id FK, 1:1) → `claim_records` (trigger on PCR submit).

## 4. Where a run/leg connects to a PCR

- **PCR record = `trip_records` row** (the PCR fields live directly on `trip_records`; `pcr_status` is a column there).
- **Link column:** `trip_records.leg_id` → `scheduling_legs.id` (unique). This is the join used everywhere:
  - `src/pages/PCRPage.tsx` lines 181–370 (all lookups by `leg_id`).
  - `src/hooks/usePCRData.ts` line 8/139–146 (loads PCR by trip, then fetches the leg by `leg_id`).
  - `src/pages/crew/CrewSchedule.tsx` line 167 (matches trips to slots by `leg_id`).
- **Creation path:** dispatcher/crew opens a scheduled run in `PCRPage.tsx` → `createTripForRun` (line 412) inserts a `trip_records` row with `leg_id = run.legId, truck_id, crew_id`. If the unique constraint on `leg_id` fires (line 550), it fetches the existing trip instead — that's the idempotency guard.
- **Downstream trigger:** on PCR submit, the DB function `auto_create_claim_on_pcr_submit` (security definer) writes the `claim_records` row.

## Summary in one paragraph

Dispatchers schedule runs in `src/pages/Scheduling.tsx`, which inserts one row per leg into `scheduling_legs` — round trips are two rows (`leg_type` A + B) sharing `patient_id` and `run_date`, not one row with two legs. Recurring patients (MWF/TTS dialysis, etc.) are configured on `src/pages/Patients.tsx` but their standing orders are **materialized per date on demand** by `autoGenerate` in `src/hooks/useSchedulingStore.tsx` (~line 300–430) when the dispatcher opens/generates that day; no server-side cron pre-expands them. Legs are assigned to trucks via `truck_run_slots`, and when a PCR is opened, `createTripForRun` in `src/pages/PCRPage.tsx` creates a `trip_records` row with `leg_id` as the unique FK back to the leg. On PCR submit, the DB trigger `auto_create_claim_on_pcr_submit` creates the corresponding `claim_records` row.
