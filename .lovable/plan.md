# Consequence check at intake: staged plan

This is advisory only. Nothing is assigned automatically, and the only database writes are the ones intake already makes. Each stage needs its own approval.

## What the audit found

**How a leg's ends connect to a facility today**
- `scheduling_legs` has no facility link. The pickup and drop-off are free-text fields (`pickup_location`, `destination_location`).
- The one-off address columns hold home or residential addresses, which are never looked up.
- `patients.facility_id` exists, but no patient row currently sets it (0 rows).
- The only workable link is an **exact name match**: the leg's text, trimmed and ignoring case, equal to a facility name in the same company. This is the same rule dispatchers already use, and facility names are kept unique per company.

**How often it applies (live data, counts only):**

| Item | Count |
|---|---|
| Legs | 48 |
| Pickups that match a facility name | 25 |
| Drop-offs that match a facility name | 23 |
| Facilities | 7, all with a street address |

A travel time can only be counted between **back-to-back stops where the first run drops off at a facility and the next run picks up at a facility**. The common case is a dialysis A-leg dropping at center X followed by a B-leg pickup at center Y.
- A gap that starts or ends at a patient's home has no location, by design, because home addresses are never looked up. It keeps today's time-only check.
- Realistic coverage is facility-to-facility hops only, probably a minority of gaps.

**Today's engine:**
- `evaluateTruckDay` (`schedule-feasibility.ts`) sorts the timed windows. It flags `overlap` when one run ends after the next starts, and `tight-gap` when the gap is under `minGapMinutes`. The tight-gap message already says "no travel time counted yet".
- `suggestTrucksForRun` calls `evaluateTruckDay(..., buffers)` and copies `buffers` with `{...input.buffers}`. Anything optional placed on `buffers` therefore passes through without changing `truck-suggestion.ts`.

---

## Stage 1: count travel time in feasibility, without changing results when locations are missing

**Design**
- `FeasibilityLeg` gets two optional fields, `originCoord?` and `destCoord?` (`Coord | null`).
- `FeasibilityBuffers` gets an optional `travelFloor?: (from, to) => number | null`. In production this is `travelFloorMinutes` from geo-distance.
- In the back-to-back loop, only when `travelFloor` is set, the first run has a `destCoord` and the next has an `originCoord`:
  - `travel = travelFloor(cur.destCoord, nxt.originCoord)`.
  - If `travel != null` and `gap < travel`, flag a new conflict kind, `travel-infeasible`. It is an error: "X ends at about 9:40 AM at a facility about N minutes from Y's 9:50 AM pickup."
  - Otherwise the existing `tight-gap` check runs as it does today. The geo check never replaces or suppresses the overlap or tight-gap checks; it only adds.
- If any input is missing, the new code is skipped entirely. Messages, order and the clear flag stay byte-identical.

**Files**

| File | Change |
|---|---|
| `src/lib/schedule-feasibility.ts` | Optional fields, a new `ConflictKind` value, and a guarded block (about 25 lines) |
| `src/lib/facility-endpoints.ts` (new) | `resolveLegFacilities(leg, facilities)`: exact-name match to `{originFacilityId, destFacilityId}`; non-matches return null. Plus `withLegCoords(leg, getFacilityCoords)`. Pure, and it only ever touches facility IDs. |
| `src/hooks/useTruckDayFeasibility.ts` | **Not changed in Stage 1.** It doesn't pass coordinates, so the board is unaffected until it is deliberately connected. |
| `src/lib/truck-suggestion.ts` | **Not changed.** Coordinates flow through `buffers` and the run objects. A `travel-infeasible` conflict involving the run is rejected by the existing "any conflict" path, but only when the caller supplies locations. |

**Risk to the shared engine:** low. The only changed file is `schedule-feasibility.ts`, and every new branch requires three optional inputs. One subtle point: adding a new conflict kind could affect code that branches on `kind`. A search found only `FeasibilityResult.tsx` and tests; the plan checks that display falls back to a sensible style for unknown kinds.

**Tests (synthetic coordinates and labels, no PHI)**
- All existing feasibility, truck-suggestion and run-candidate tests run unchanged and must pass. This is the backward-compatibility proof.
- New tests in `schedule-feasibility.geo.test.ts`:
  - No coordinates gives output deep-equal to the version without the `travelFloor` option.
  - A 20-minute gap between facilities about 30 miles apart is flagged `travel-infeasible`.
  - The same gap with nearby facilities shows no travel conflict.
  - A home at one end (null coordinate) means no geo check.
  - `travelFloor` returning null means no geo check.
  - Overlap and tight-gap still fire alongside the new check.
- New tests in `facility-endpoints.test.ts`: exact name matching, case and spacing tolerance, no partial matches, and an unknown name returning null.

**Size:** about 120 lines including tests.

---

## Stage 2: pure acceptance evaluator

`src/lib/run-acceptance.ts`:
```text
evaluateRunAcceptance({ run, candidates, buffers, priorityOf })
 -> { coverable, leastBadTruck, perTruck: [{truckId, clean, breaks:[{legId, kind, howLateMin, tier}]}] }
```
- **Clean placement:** `suggestTrucksForRun` is reused as-is. If any truck is eligible, the run is `coverable` and `leastBadTruck` is the top-ranked truck with no breaks.
- **When something has to give:**
  - For each crewed truck that is not hard-blocked, the shared `evaluateTruckDay([...existing, run], buffers)` is run. This step only handles time conflicts; down, ALS and safety blocks stay hard rejects.
  - Conflicts involving the run become `breaks` on the other leg, with `howLate` taken from the window math: the overlap minutes, or the late-to-appointment overrun.
- **Priority tiers decide who absorbs lateness**, using `deriveRunPriority`:
  - A truck that breaks any **Tier 1** leg is excluded from "least bad".
  - Among the rest, the best truck has the fewest Tier 2 breaks, then the fewest total late minutes on Tier 3, then the `suggestTrucksForRun` order breaks ties.
  - If the run itself is Tier 3 and a placement would delay a Tier 1 or 2 leg, that is reported as "this run should yield".
- The evaluator is pure: no database or network access, and locations arrive already attached to the legs (from Stage 1).

**Tests (synthetic):**
- A clean truck gives coverable with no breaks.
- No clean truck but one acceptable sacrifice gives a least-bad truck plus breaks.
- A truck whose only option breaks a Tier 1 leg is excluded.
- Fewer Tier 2 breaks beats fewer total minutes.
- Safety, ALS or down blocks are never "least bad".
- With no crewed trucks, coverable is false and no truck is recommended.
- With locations supplied, a travel-infeasible pair becomes a break.

**Size:** about 150 lines of code and about 120 lines of tests.

---

## Stage 3: show it at one intake point

**Recommended: the Scheduling board's add one-off run form** (`src/pages/Scheduling.tsx`, one-off form).
- That page already loads the day's trucks, crews, timing settings and assigned legs (`useTruckDayLegs`), and it is where a run is accepted for the day.
- **Create PCR is a poor fit for v1.** It records past or same-day work, often after the transport happened, so "what would this push late" mostly doesn't apply.
- I recommend one place only: the scheduling board.

**User experience:** this mirrors "Suggest trucks".
- A "Check impact" button sits next to the one-off form's save button and runs only when clicked.
- It shows a small yellow or green card near the save button with three lines:
  - **Coverable?** Yes, or "No crewed truck can take this".
  - **Pushes late:** for example "Dialysis A-leg (T1) +12 min" or "nothing".
  - **Least-bad truck:** the truck name and one reason.
- Save is never blocked or changed. The card clears when relevant fields change, following the warn pattern.

**Files**

| File | Change |
|---|---|
| `src/components/scheduling/IntakeImpactCard.tsx` (new) | Display-only card, about 90 lines |
| `src/pages/Scheduling.tsx` | Button, state and a call to the evaluator, about 40 lines. Reuses `buildTruckCandidates` and the `useTruckDayLegs` data. |
| `src/hooks/useTruckDayLegs` area | Facility names are fetched with the company scope (`getActiveCompanyId`). `getFacilityCoords` is called only for resolved facility IDs, and the result is attached as an optional input to this evaluator only. The existing board feasibility stays time-only. |

**Tests:** a pure adapter test covering form values to the prospective run, plus Stage 2's tests. There are no styling or snapshot tests.

**Size:** about 150 lines.

---

## Blockers and caveats
- **No migration is needed** in any stage.
- **Coverage:** locations only help facility-to-facility hops. Gaps involving a patient's home stay time-only until a geocoder covered by a BAA exists. Leaving `patients.facility_id` unset changes nothing, because endpoints come from name matching.
- **First check is often time-only:** location lookup is lazy. The first click may come back time-only and fill in on the next check. The card will say "travel time not yet counted for N stops".
- **Free-text names:** a drop-off typed differently from the facility name won't match. Exact matching is deliberate; fuzzy matching risks wrong-location routing.
- **Stage 1 changes results only when callers pass locations,** and in v1 only the intake evaluator does. Existing board feasibility and Suggest trucks results are unchanged.
