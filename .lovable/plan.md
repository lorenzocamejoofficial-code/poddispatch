# Truck Suggestions — "manual mode" assist on the Scheduling board

Advisory only. No DB writes, no auto-assign, no change to `src/lib/truck-suggestion.ts` or its dependencies. Same roles that already reach `/scheduling` (owner, dispatcher, creator per `src/App.tsx`).

## (a) Where run placement lives and the trigger point

- Board: `src/pages/Scheduling.tsx` wraps `RunPool` (unassigned runs) and `TruckBuilder` (truck cards) in one `DndContext` (about lines 1238–1411).
- Placement: `handleDragEnd` in `Scheduling.tsx` (line 949 on) handles a drop on `truck-drop-<truckId>` (the droppable set up in `TruckBuilder.tsx` around line 781) and inserts `truck_run_slots`. This stays unchanged.
- Note: `src/components/dispatch/TruckCard.tsx` belongs to the **Dispatch Board**, not Scheduling. The Scheduling truck card is the inline card component in `TruckBuilder.tsx` (line 776 on). That is the card to annotate. `TruckCard.tsx` is not touched.
- Best trigger: a small **"Suggest trucks"** button on each unassigned run row in `RunPool.tsx`. A drag start would also work as a trigger, but it fires on every reorder and the reasons would be unreadable mid-drag. So drag start is not used.

## (b) Can TruckCandidate[] be built read-only from data already loaded?

Mostly yes. These pieces are already in `TruckBuilder.tsx`:
- **Crew capability**: the crews query (line 296) loads sex and the stair-chair, bariatric, oxygen and lift-assist flags for member1–3. This matches `CrewCapability`. "Crewed trucks only" means the truck has a `crews` row for the day.
- **Equipment**: trucks query (line 307) loads `has_power_stretcher`, `has_stair_chair` and `has_oxygen_mount`.
- **Down/OOS for the day**: the `truck_availability` read (line 341) and the existing `isDown` value.
- **Patient needs**: `LegDisplay` already has weight, mobility, stairs, stair chair, oxygen, special equipment and bariatric.
- **Buffers and timing**: `useTruckDayFeasibility` already reads `company_settings` and builds `FeasibilityLeg`s per truck, scoped with `getActiveCompanyId()`/`NO_COMPANY`.

Still missing (all are read-only additions):
1. **Truck `service_level`, `has_bariatric_kit`, `has_bariatric_stretcher`** are not selected. Fix: add these columns to the existing trucks select in `TruckBuilder.tsx`. It is the same query, already company-scoped.
2. **Run `service_level`** is fetched (`scheduling_legs` `select("*")` in `useSchedulingStore.tsx`), but the `LegDisplay` mapping drops it. Fix: add an optional `service_level` field and map it. Read-side only. If it is missing, use "BLS".
3. **Per-truck `assignedRuns: FeasibilityLeg[]` and the run's own `FeasibilityLeg`**: the hook builds both but returns only the evaluated result. Fix: add an additive return (`legsByTruck`, `buffers`) and pull the existing leg-building into a reusable `toFeasibilityLeg`. The existing `Map` return and its tests stay the same. The unassigned run is converted with the same function, so timing matches the feasibility badge exactly.
4. **`maxPatientWeightLbs`**: no column exists in the schema (no migration defines a rated capacity). It is left `undefined`, so the engine skips that check. This is not a blocker, and no value is invented.

No blockers. Nothing needs a migration.

## (c) Trigger UX

- Click **"Suggest trucks"** on an unassigned run. The run row gets a subtle "suggesting" ring. A one-line banner above the truck grid reads "Suggestions for <patient> <A/B> <time>", with a **Clear** button.
- Each crewed truck card gets a small header chip:
  - Eligible: "#1 Best fit", "#2", "#3"… with a primary-tinted border on #1 only. Below the header, a collapsible "Why" line shows the engine's first reason; expanding shows all of its reasons.
  - Ineligible: a muted card with a "Not suitable" chip and the engine's rejection reason on one line.
  - Un-crewed trucks: no chip (not candidates). The banner shows "N trucks skipped: no crew".
- The highlight clears on Clear, Escape, a change of date, a successful drop of that run, or picking another run. It is never always-on.
- Placement is unchanged: the dispatcher drags the run onto any truck, including a lower-ranked one.

## (d) Synthetic test fixtures

New `src/lib/truck-suggestion-candidates.test.ts`, covering the pure adapter only (the engine already has its own tests). It uses synthetic IDs and names, with no PHI:
- Two crewed trucks plus one un-crewed truck → the un-crewed truck is excluded from candidates.
- An ALS truck selected with `service_level` → maps to `"ALS"`. A missing run level → `"BLS"`.
- A down truck from availability → `downForDay: true` → the engine rejects it with the down/out-of-service reason.
- A bariatric patient (320 lb) with an MF crew and no power stretcher → rejected. The same patient with a trained crew and a power stretcher → eligible (checks the adapter wiring through the safety matrix).
- An existing run 20 min after the candidate's window → time-conflict rejection (45-min rule).
- Reassign case: the run is already on truck A → its own slot is ignored (`legId` excluded).
- `maxPatientWeightLbs` is always `undefined` (guards against an invented capacity).
- Plus one hook test in `useTruckDayFeasibility.test.ts` asserting the new `legsByTruck` matches the legs behind the existing map.

## Files

| File | Change | ~LOC |
|---|---|---|
| `src/lib/truck-suggestion-candidates.ts` (new) | Pure `buildTruckCandidates(...)` + `toSuggestionRun(leg)` | 90 |
| `src/hooks/useTruckDayFeasibility.ts` | Pull out `toFeasibilityLeg`; additive `legsByTruck` + `buffers` export (existing return unchanged) | 40 |
| `src/hooks/useSchedulingStore.tsx` | Optional `service_level` on `LegDisplay` mapping | 5 |
| `src/components/scheduling/TruckSuggestionReasons.tsx` (new) | Presentational chip + reason line(s) | 70 |
| `src/components/scheduling/RunPool.tsx` | "Suggest trucks" button + `onSuggest(leg)` / active ring | 25 |
| `src/components/scheduling/TruckBuilder.tsx` | Extra truck columns in the existing select; accept `suggestion` prop; render reasons in the card header; banner + Clear | 70 |
| `src/pages/Scheduling.tsx` | `suggestFor` state; pass it down; clear on date change / drop / Escape | 25 |
| Tests (above) | | 150 |

Total is about 475 LOC, within the cap.

## Out of scope and unchanged

`truck-suggestion.ts`, `schedule-feasibility.ts`, `safety-rules.ts`, `time-conflict.ts`, `patient-time-prediction.ts`, `handleDragEnd` and every insert/assign path, `dispatch/TruckCard.tsx`, NEMSIS, billing and migrations.
