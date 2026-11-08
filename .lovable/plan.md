# Link run pickup/destination to a facility record

## What the audit found
- `scheduling_legs` has no facility link today. Endpoints are the required text fields `pickup_location` and `destination_location`.
- One-off runs also copy that text into `oneoff_pickup_address` and `oneoff_dropoff_address`. When "needs B-leg" is ticked, the return leg gets the two ends swapped.
- Leg exceptions (`leg_exceptions.exception_pickup_location` / `exception_destination_location`) can override a leg's text for a given day.
- **One-off form** (`src/pages/Scheduling.tsx`, about lines 1611–1612): both endpoints are plain `Input` fields. The destination placeholder already says "Facility name or address".
- **Recurring/regular leg form** (about lines 1864–1865): uses `AddressComboInput`, which suggests the patient's home address and their dropoff facility as text only.
- **Loading:** `useSchedulingStore.fetchLegs` selects `*`, so new columns load automatically. `LegDisplay` would need the two fields added.
- **Data:** 48 legs, 7 facilities. About half the endpoints already match a facility name exactly.

## (a) Schema: one additive migration
```sql
ALTER TABLE public.scheduling_legs
  ADD COLUMN pickup_facility_id uuid NULL REFERENCES public.facilities(id) ON DELETE SET NULL,
  ADD COLUMN destination_facility_id uuid NULL REFERENCES public.facilities(id) ON DELETE SET NULL;
CREATE INDEX ... ON public.scheduling_legs (pickup_facility_id) WHERE pickup_facility_id IS NOT NULL;  -- and destination
```
- **Nullable, with no default and no trigger.** Every existing writer keeps working unchanged: recurring auto-generate, copy-forward, imports, Create PCR and the crew run picker.
- **The text columns stay authoritative for display** and for home or free-text endpoints.
- **`ON DELETE SET NULL`:** facilities are normally deactivated, not deleted, but a removed facility must not break or orphan legs.
- **Same company:** a guard trigger (`BEFORE INSERT/UPDATE`) rejects a facility from a different company than the leg. This is a validation trigger, not a CHECK, because it looks up another table. Without it, a crafted request could link a leg to another tenant's facility.
- **No RLS or grant changes.** These are new columns on a table that is already granted and protected.
- **Backfill: defer it.** The resolver falls back to the exact-name match anyway (see c), so a backfill would not make the consequence check better today. It would only copy the same result into a column. It also means running a data write against live rows, and if it's ever wanted it can be a separate, reviewable step.

## (b) UX: v1 on the one-off add-run form only
- New `FacilityEndpointInput` component (`src/components/scheduling/FacilityEndpointInput.tsx`), replacing the two plain inputs on the one-off form:
  - Typing shows a short list of the company's active facilities filtered by name, plus "Use as typed (home / other address)".
  - Picking a facility sets the facility id and fills the display text with the facility **name**. This matches today's practice, where dispatchers choose by name and facility names are unique per company.
  - Typing anything afterwards clears the link, so the id and the text can never disagree.
  - A small "Facility" chip with an × shows when a facility is linked.
- **Optional and fast.** No facility is required. Home pickups work exactly as they do now, and required-field validation is unchanged.
- The facility list is loaded once with the active-company scope (`getActiveCompanyId`/`NO_COMPANY`, `active = true`). It reuses the facilities list the impact check already fetches.
- **Save:** `pickup_facility_id` and `destination_facility_id` are added to the one-off insert. The **B-leg gets the ids swapped**, mirroring how its text is swapped.
- **Later pass, not v1:** the recurring/regular leg form, recurring auto-generate, Create PCR, and leg-exception edits.

## (c) Resolution: prefer the facility link, keep the name match
`resolveLegFacilities(leg, index)` becomes:
1. If the leg has a facility id for that end **and** no text override from a leg exception for that end, use the id.
2. Otherwise, fall back to today's exact-name match (trim, ignore case) on the effective text.

- An exception override always wins, because it means the leg goes somewhere else that day.
- The existing exact-name tests stay unchanged.
- `LegInfo` in `intake-impact.ts` gets the two optional ids. The Scheduling impact check passes them from `LegDisplay`, and the one-off form passes its picked ids for the new run.
- Advisory, non-blocking behavior is unchanged: geo still only applies on facility-to-facility hops with coordinates.

## (d) Tests and size

**Tests (synthetic, no PHI)**
- `facility-endpoints.test.ts`:
  - The id wins over a mismatched name.
  - An exception text override beats the id.
  - With a null id, the name-match fallback still works.
  - An unknown or deactivated facility id with no name match returns null.
  - Existing exact-name tests stay unchanged.
- `intake-impact.test.ts`: a run whose free text matches no facility name, but which is linked by id, now gets a travel-infeasible break on a far facility-to-facility hop.
- `FacilityEndpointInput` logic, extracted as a pure `applyEndpointChoice` helper:
  - Picking sets the id and the name.
  - Editing the text clears the id.
  - The B-leg swap maps the ids correctly.
- Same-company guard: a migration-level SQL check run through the database query tools, as a one-off verification (no test-suite addition).
- Full suite run.

**Size (about 250 lines)**

| Area | Lines |
|---|---|
| Migration | ~25 |
| Endpoint picker component | ~110 |
| Pure helper and its tests | ~50 |
| `facility-endpoints.ts` change | ~20 |
| `Scheduling.tsx` wiring and B-leg swap | ~30 |
| `LegDisplay` and `intake-impact.ts` | ~15 |

**Files**
- `src/lib/facility-endpoints.ts`
- `src/lib/intake-impact.ts`
- `src/components/scheduling/FacilityEndpointInput.tsx` (new)
- `src/pages/Scheduling.tsx` (one-off form only)
- `src/hooks/useSchedulingStore.tsx` (`LegDisplay` fields)
- Tests listed above
- `AGENTS.md` rule update. Not touched: NEMSIS, billing, `geo-distance.ts`.

## Blockers and caveats
- **No hard blockers.**
- **Coverage stays partial until later passes:** recurring legs from auto-generate and copy-forward won't carry ids until a later pass. They keep using the name-match fallback, which is today's behavior.
- **Display text:** picking a facility fills its name, not its street address, matching current dispatcher practice. If crews need the street address in the text, that's a one-line change; please say if you'd prefer "Name — address".
- **Stale display text:** renaming a facility won't rewrite the text on existing legs, but the id link keeps geo resolution correct regardless.
