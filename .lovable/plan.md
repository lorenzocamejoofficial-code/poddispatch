# History-first timing for the consequence check

Advisory only. No database changes, no writes, no NEMSIS/billing changes. When no history exists, output stays byte-identical.

## (a) What already exists (do not rebuild)

`src/lib/patient-time-prediction.ts` (pure, MIN_SAMPLES = 5, 180-day lookback, newest 20, only completed/ready_for_billing, emergency upgrades excluded):
- **Trip duration** `tripDurationSamples`: pickup arrival (`at_scene_time` / `in_service_time`) to drop (`dropped_at` / `arrived_dropoff_at`), 5–240 min, split by A / B / all.
- **A→B turnaround** `turnaroundSamples`: A-leg drop to same-day B-leg patient contact, 60–480 min.
- `summarize` returns median/p25/p75/confidence (`none` under 5 samples); `suggestTripDuration` (history > plan > 30) and `suggestReturnPickup` (chair + median turnaround > chair + planned chair + buffer).
- `usePatientTimeStats` loads these per patient, company-scoped, session-cached.

Already used in feasibility (`toFeasibilityLeg` in `src/hooks/useTruckDayFeasibility.ts`):
- `tripMinutes` = learned median for the leg kind, then `estimated_duration_minutes`, then patient `run_duration_minutes`, then 30. This covers **every existing assigned leg** on the board, the truck badges, truck suggestions and the impact check's existing-run legs (they all reuse `dayLegs.stats`).
- `predictedReturn` for B legs comes from `suggestReturnPickup` (learned turnaround first), but `evaluateTruckDay` only uses it when the B leg has **no scheduled pickup time**.

Not done today:
- The impact check's **prospective run** is built with `patient_id: null`, so it always gets the 30-min default (or nothing learned).
- No segment records **which source** it used; the impact card cannot say.
- The gap between two runs is only the static minimum gap plus the geo floor (facility-to-facility only). No learned gap.

## (b) Transport duration for the prospective run

- Honest blocker: the Scheduling one-off form has no patient field. One-off runs are saved with `patient_id: null` by design, so there is no history to load for them.
- Plan: keep one-offs on planned → default (unchanged). Add an optional path so that when an intake run *does* carry a `patient_id` (for example from the recurring add-run form, which has a patient picker), its stats are loaded with `usePatientTimeStats` and merged into the stats map passed to `toFeasibilityLeg`. Existing legs already use learned medians; no change there.
- Decision for you: should the one-off form gain an optional "existing patient" picker? Not included by default.

## (c) Gaps between consecutive runs

- **A→B turnaround is not a truck gap.** It measures how long the patient sits in the chair; the truck normally leaves and does other work. Using it as the gap between the A and B legs on one truck would be wrong. What it does honestly tell us is when the patient will be ready. Additive use: when a B leg has a scheduled pickup **earlier** than the history-predicted ready time by more than grace, raise a new warning `early-return` ("patient usually ready around X"). This only fires when history exists (confidence not `none`), so no-history output stays identical.
- **Deadhead between two different runs: no reliable learned signal.** PCR stamps give previous drop → next `in_service`/`at_scene` on the same truck, but that interval mixes driving, waiting, breaks and fuel stops. There is no "left drop-off" or "en route" stamp recorded consistently, and it is not tied to a facility pair. It stays **geo floor → static gap**. Not invented.

## (d) Precedence and visibility

Per segment, consistently:

```text
trip duration : patient history (n >= 5) > planned > default 30
return ready  : patient turnaround history > planned chair + buffer > none
gap to next   : geo floor (both ends facilities) > static minimum gap
```

- Add an optional `timingSource` to `FeasibilityLeg` (`{ trip: "history"|"plan"|"default"; n; confidence }`) filled by `toFeasibilityLeg` from the existing `suggestTripDuration` (reused, not reimplemented). Optional field, so existing tests and outputs are unchanged.
- Add optional `gapSource: "distance" | "default"` on gap/travel conflicts only when a travel floor is in play.
- Impact card: one small "How times were estimated" line per affected run: "from this patient's history (n trips)", "estimated from distance", "default gap", "default trip length".

## Technical details

Files:
- `src/hooks/useTruckDayFeasibility.ts` — `toFeasibilityLeg` uses `suggestTripDuration` for the same value and sets `timingSource` (~20 LOC).
- `src/lib/schedule-feasibility.ts` — optional `timingSource` on legs; optional `predictedReady` on B legs; `early-return` warning only when `predictedReady` is set and history-sourced; `gapSource` tag (~45 LOC).
- `src/lib/intake-impact.ts` — accept optional prospective `patientId` + stats; collect sources into the result (~30 LOC).
- `src/pages/Scheduling.tsx` — pass through stats for an intake run with a patient (none for one-offs today) (~10 LOC).
- `src/components/scheduling/IntakeImpactCard.tsx` — source lines (~35 LOC).
- Tests (synthetic, no PHI): `schedule-feasibility.timing.test.ts` (no history → byte-identical to current output via deep-equal against legacy builder; 4 samples ignored, 5 used; early-return fires only with history; source tags), additions to `intake-impact.test.ts` (prospective patient with history uses median; one-off stays default) (~140 LOC).
- Total about 280 LOC. All existing feasibility, truck-suggestion and candidate tests must pass unchanged.

## Blockers / risks

1. One-off runs have no patient, so the prospective-run history path is inactive on the only surface the impact card lives on until a patient link exists (decision above).
2. History is per patient, not per hop: a patient with two different destinations shares one median. Splitting by destination would usually drop below 5 samples; left as is.
3. Learned deadhead is not derivable from current stamps (see c).
