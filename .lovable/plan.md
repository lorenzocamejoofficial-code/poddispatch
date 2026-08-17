# Driver derived in the field + third-member roles

Driver is no longer picked at scheduling. It is derived from who is NOT charting the PCR. The optional third crew member gets an admin-assigned role, and that role decides how strict the certification gate is for them. The trainee never counts as a clinician.

## Part 1 — Remove the driver select from Trucks & Crews

Files: `src/pages/TrucksCrews.tsx`, `src/lib/crew-composition.ts`

- Remove the "Driver" `<Select>`, the `driverId` state, and all resets of it in the edit/cancel handlers.
- Stop sending `driver_member_id` on save, with one exception: if the third member's role is `driver`, we write `driver_member_id = member3_id` so the field stays truthful. Otherwise we write `null`. It is never a save blocker and the column stays in place (legacy).
- The inline crew roster labels currently derived from `driver_member_id` (lines ~278-301) change to show the third member's assigned role instead of "Driver / Attendant" guesses.

### Redefined crew validity (no driver required)

`evaluateCrewComposition` drops the "Designate which crew member is the driver" error entirely. New rule set, evaluated only over the **primary two members** (member1, member2):

1. Two primary members must be present ("A truck needs at least two crew members").
2. At least one primary member must be a certified attendant: cert level EMT-B, EMT-A or EMT-P. EMR still never counts (driver-only).
3. Two EMRs remains invalid, same message as today.
4. The third member is excluded from this calculation entirely, whatever their role.

`crewCapability` (ALS vs BLS) is likewise computed from the primary two only — so a paramedic trainee riding third can never upgrade a BLS crew's capability. The function keeps its `roles` output but roles become: primary members are `attendant`, third member is its assigned role. `driverId` becomes an optional argument used only for display.

## Part 2 — Third-member role

New column on `crews`:

```
member3_role text  -- 'second_medic' | 'lift_assist' | 'driver' | 'trainee'
```

- Enforced with a CHECK constraint (text, not an enum, so future roles are cheap).
- A validation trigger requires `member3_role` to be non-null when `member3_id` is set, and null when it isn't.
- Admin picks the role in the Trucks & Crews crew editor, in a select that appears only once a third member is chosen. Saving a third member without a role is blocked in the UI with a clear message.
- Same column/param added to `truck_builder_templates` copy-forward paths and to `safe_assign_crew` (new `p_member3_role` argument, added as a new overload so existing callers keep working).

## Part 3 — Cert gating per third-member role

The gate lives in two places today and both must agree: `public.crew_assignable(user_id)` (all three of Medic #, CPR, Driver's License approved) called from `enforce_crew_cert_gate()` and from `safe_assign_crew`.

New function `public.crew_assignable_for_role(_user_id uuid, _role text)`:

| Role | Required approved, unexpired certs |
|---|---|
| primary member 1 / 2 (unchanged) | Medic #, CPR, Driver's License |
| `second_medic` | Medic #, CPR, Driver's License (same as primary) |
| `driver` | Driver's License + CPR (no Medic #) |
| `lift_assist` | CPR only |
| `trainee` | none required |

`enforce_crew_cert_gate()` and `safe_assign_crew` are rewritten to call the role-aware function: primary members always go through the full check; the third member goes through the check for its role. The existing full-strength behaviour is preserved for every seat that isn't the third one, so nothing already assigned becomes invalid.

### Keeping the trainee out of clinical and billing

- The certified-attendant rule (Part 1) only looks at member1/member2, so a trainee can never satisfy it.
- The attending-medic picker on the PCR is restricted to primary members with an attendant-level cert; third members are only offered when the role is `second_medic`. `trainee`, `lift_assist` and `driver` third members are filtered out of the attending-medic list.
- `crewCapability` / `deriveUnitCapability` ignore the third member, so a trainee cannot influence BLS/ALS display or dispatch capability.
- Nothing in `src/lib/crew-composition.ts` is read by claim generation or pricing (documented at the top of that file), and no billing path gains a member3 read, so the trainee touches no claim, level of service, or medical-necessity logic.

Confirmed: **a Trainee/Observer can never be the billable attendant.**

## Part 4 — Shared driver-derivation helper

New file `src/lib/derive-driver.ts`, exporting `deriveDriver({ crew, attendingMedicId })`:

1. If `crew.member3_role === 'driver'` and `member3_id` is set → the third member is the driver. (Explicit admin assignment wins.)
2. Else if `attendingMedicId` matches one of the primary two → the *other* primary member is the driver.
3. Else if only one primary member is present → that person is the driver only when they are not the attending medic; otherwise unknown.
4. Else (no PCR started / no attending medic yet) → `null`, and callers show "Driver: not yet determined".

Pure display logic; it writes nothing and is never called at scheduling time.

## Part 5 — Live display on dispatch cards and the fleet map

**Dispatch board** — `src/pages/DispatchBoard.tsx`, `src/components/dispatch/TruckCard.tsx`
- Widen the crews select to include `member3_role` and keep the member ids it already pulls; widen the trip select to include `attending_medic_id`.
- Pass a `crewDetail` object (member ids/names, `member3_role`, current `attending_medic_id`) to `TruckCard` alongside the existing `crewNames`.
- `TruckCard` renders a "Driver: X" line under the crew line and, when a third member exists, "3rd: Trainee — Name" using a role label map.
- The board already subscribes to `crews` and `trip_records` realtime, so a medic swap in the field flips the driver line without a reload.

**Fleet map** — `src/hooks/useTruckTripStatus.ts`, `src/pages/FleetMap.tsx`
- Widen the `trip_records` select with `attending_medic_id` and `crew_id`, and fetch today's crews (member ids + names + `member3_role`) for the company so the helper has a roster.
- Extend `TruckTripStatus` with `driverName`, `attendingMedicName`, `thirdMember` ({ name, role }).
- `FleetMap` unit detail card shows Driver, Attending medic, and the third member with their role; the unit list gets a compact "Driver: X".
- Existing `trip_records` realtime subscription already refreshes this.

## Technical notes

- One migration: `crews.member3_role` + CHECK + presence trigger, `crew_assignable_for_role`, rewritten `enforce_crew_cert_gate`, new `safe_assign_crew` overload with `p_member3_role`. `driver_member_id` is left in place and untouched by the migration.
- No changes to claim generation, `claim-readiness`, pricing, or NEMSIS paths.
- A unit test covers `deriveDriver` (2-person, 3-person-with-driver-role, no-medic-yet) and the redefined `evaluateCrewComposition` (two EMRs invalid, no-driver-designated now valid, trainee third does not satisfy attendant).
