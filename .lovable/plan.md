# Patient time prediction — trace findings and proposed design

## Trace findings

### 1. Actual-time data recorded today
**trip_records (crew PCR time card, one row per leg):**
- `dispatch_time` (unit notified), `in_service_time` (en route), `at_scene_time` (arrived at pickup), `patient_contact_time` (at patient), `left_scene_time` (left pickup), `arrived_dropoff_at` (arrived destination), `dropped_at` (patient handed off), plus `arrived_pickup_at` and `loaded_at` (status-button stamps).
- Odometers: `odometer_in_service`, `odometer_at_scene`, `odometer_at_destination`.
- `wait_time_minutes` (built from resolved hold timers), and `scheduled_pickup_time` / `scheduled_dropoff_time` (planned, not actual).

**Other tables:**
- `trip_status_history.changed_at`: a stamp for each status change (65 rows), a backup source for the same events.
- `hold_timers.started_at` / `resolved_at`: delays at the facility.
- `trip_events.event_time`: exists but has 0 rows.
- `scheduling_legs`: only planned values: `pickup_time`, `chair_time`, `estimated_duration_minutes`.
- `patients`: only planned values: `chair_time`, `chair_time_duration_hours/minutes`, `run_duration_minutes`, `a_leg_pickup_time`, `dialysis_window_minutes`.
- Nothing records the moment the patient was actually ready for the return trip. The closest proxies are the A-leg `dropped_at` (chair start) and the B-leg `patient_contact_time` / `left_scene_time` (actual return pickup).

### 2. How much history exists: essentially none
- `trip_records` has 4 rows: 1 ready_for_billing, 2 cancelled, 1 scheduled. Earlier test trips were reset.
- Only 1 trip has a full time card. It is an A-leg with no matching B-leg, for 1 patient.
- No patient has 2 or more completed trips. No patient has a matched A+B pair on the same day.
- Conclusion: the timestamp fields exist and get filled when a PCR is completed, but no per-patient average or median can be computed today. Every patient starts with no history, so the fallback path is what will run at launch.

### 3. What exists toward durations today
- The scheduler builds legs from planned values only (`useSchedulingStore.tsx` ~line 365): travel = `run_duration_minutes ?? 30`; treatment = the per-day override, else the patient's chair duration, else 210 min for dialysis / 60 min otherwise.
- `dialysis_b_leg_buffer_minutes` (company setting, default 15) and `isBLegTooEarly()` in `dialysis-validation.ts` flag B-legs scheduled before chair time + duration. Reports and Metrics uses this.
- `dispatch-intelligence` uses `estimated_duration_minutes ?? 10` for hold and delay logic.
- No averages, medians or analytics are built from actual times anywhere.

## Proposed design

### Shared source: per-patient actuals (computed on read)
A pure TS module `src/lib/patient-time-prediction.ts` takes a patient's last N completed or ready_for_billing trips (active company, not simulated unless the company is a sandbox, newest 20, within 180 days) and works out:
- **Chair/turnaround (A→B):** for the same patient and date, B-leg `patient_contact_time` (else `left_scene_time`) minus A-leg `dropped_at` (else `arrived_dropoff_at`). This is the time from chair start to ready-for-pickup, including normal wait.
- **Trip duration:** `dropped_at` (else `arrived_dropoff_at`) minus `at_scene_time` (else `in_service_time`). Kept per leg type and destination.
- **Validity filters:** both stamps present and in order; drop cancelled, no-show and emergency-upgraded trips; drop outliers (turnaround outside 60–480 min, trip outside 5–240 min).
- **Output:** median, 25th–75th percentile range, sample size `n`, and a confidence level.

### Target 1: return-ready suggestion
- Predicted ready time = chair time + median turnaround (falling back to planned chair duration + company buffer).
- Shown as an advisory chip ("Suggested return pickup 13:40 · based on 6 trips · medium") next to the B-leg pickup time in the Scheduling leg dialog and the patient's recurring schedule editor. A one-click "Use suggestion" fills the field; the user still saves.

### Target 2: trip-duration suggestion
- Predicted duration = median trip duration for that patient and leg type (falling back to `run_duration_minutes`, then 30).
- Shown as a hint next to estimated duration in the add-run and one-time run forms, and as a small "~42 min typical" tag on truck-board slots, for packing. The 45-minute gap rule and the scheduler itself are not changed.

### Confidence and cold start
- n < 5 valid samples: show no number from history. Show "Using plan default (not enough history: n/5)", with the planned value as the suggestion.
- n 5–9: low confidence. n 10–19: medium. n ≥ 20 and IQR ≤ 30 min: high.
- **Minimum sample: 5.** A single trip is never used. Because history is empty today, every patient will show the default state until about 2–3 weeks of MWF/TTS service has built up.

### Computed on read, not stored
- Volumes are small (≤20 trips per patient, max 30 trucks × 10 runs), the inputs change after every PCR, and there is nothing to keep in sync or backfill.
- One query per company, scoped by `getActiveCompanyId()` / `NO_COMPANY`, fetches the needed timestamp columns for the patients visible on screen. It is cached client-side for the session. If this later becomes slow, a read-only SQL view can be added without changing callers.

## Guardrails
- No new crew time entry: uses only existing PCR and status stamps. Flag: there is no true "patient ready" event. Turnaround is inferred from the actual B-leg pickup, so it includes any time the patient waited for the truck. That biases the prediction late, which is the safe direction. A "patient ready" button for crews is optional future work and not part of this plan.
- Advisory only: nothing auto-writes a pickup time or duration. Values change only when the user clicks "Use suggestion" and saves through the existing form.
- Additive: one new lib, a small hook, UI chips. No schema change, no trigger change, and no changes to the scheduler engine, PCR gate, billing or NEMSIS/CTA.

## Technical details
- New `src/lib/patient-time-prediction.ts` (pure functions: pairing, filters, median/IQR, confidence) plus `patient-time-prediction.test.ts` (min-5 rule, outlier filtering, A/B pairing on same date, fallback ordering, confidence tiers).
- New `src/hooks/usePatientTimeStats.ts`: company-scoped `trip_records` select joined to `scheduling_legs.leg_type`, `.in("patient_id", ids)`, status in (completed, ready_for_billing).
- UI touch points: Scheduling leg dialog (B-leg pickup, estimated duration), Patients recurring schedule section, truck-slot tag in TruckBuilder.
- Verify: typecheck, full tests, and a seeded Simulation Lab check that chips show the default state with n<5 and a median with n≥5.

## Open questions
1. Should simulated (Simulation Lab) trips count toward history in sandbox companies? Proposed: yes for sandbox only, so the feature can be demoed.
2. Is a minimum of 5 samples and a 180-day lookback acceptable?
