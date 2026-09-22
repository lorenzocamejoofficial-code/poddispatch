# Close two tenant-scoping gaps (Dispatch Board + Trips sync)

Goal: every read and write on these two screens is limited to the company the user is currently working in. Same-company users keep seeing all of their own data. No access rules (RLS) or creator policies are touched.

## Item A — Dispatch Board secondary queries

The page already resolves `scopedCompanyId` (via `getActiveCompanyId()`, falling back to the `NO_COMPANY` sentinel) and uses it on trucks, alerts, safety_overrides and hold_timers. These siblings in the same `Promise.all` are missing it:

| Query | Has own `company_id`? | How it gets scoped |
| --- | --- | --- |
| `truck_run_slots` | Yes | `.eq("company_id", scopedCompanyId)` |
| `truck_availability` | Yes | `.eq("company_id", scopedCompanyId)` |
| `trip_records` | Yes | `.eq("company_id", scopedCompanyId)` |
| `payer_billing_rules` | Yes | `.eq("company_id", scopedCompanyId)` |
| `crews` | Yes | `.eq("company_id", scopedCompanyId)` |
| `operational_alerts` | Yes | `.eq("company_id", scopedCompanyId)` |
| `leg_exceptions` | **No column** | Scope through its parent: filter on `scheduling_leg_id` in the set of leg ids already loaded from this company's `truck_run_slots` for the selected date. If that set is empty, skip the query and use an empty exception map. |

Verified against the live database: `leg_exceptions` has only `id, scheduling_leg_id, run_date, pickup_time, pickup_location, destination_location, notes, created_at` — no company column — so it is the only one that must go through a parent.

Because `leg_exceptions` now depends on the slot ids, the fetch is split into two steps: the scoped batch first, then the exceptions lookup keyed off the returned legs. Everything downstream (exception map, run building) is unchanged.

Realtime: all nine subscriptions on this page already carry `filter: companyFilter`. No change needed.

## Item B — Trips & Clinical slot sync (read then write)

`syncSlotsToTrips` currently reads `truck_run_slots` and `trip_records` by date only, then inserts derived trip rows using `company_id` copied from the slot. Fix:

1. Resolve the active company once at the top (`getActiveCompanyId()` with the `NO_COMPANY` fallback, matching the pattern already used elsewhere in this file).
2. Scope the slot read with `.eq("company_id", activeCompanyId)`.
3. Scope the existing-trip read the same way, so dedup compares against this company's trips only.
4. Scope the crew lookup the same way.
5. Defensively skip any slot whose `company_id` is not the active company, and set the new trip's `company_id` to the active company id rather than copying it from the slot.
6. Backfill updates (`slot_id`/`crew_id` on existing trips) also get `.eq("company_id", activeCompanyId)` so a write can never land on another company's trip row.
7. Bail out early when the active company resolves to the sentinel — no rows read, none written.

Also noted while reading: the Trips & Clinical realtime channel subscribes to `trip_records` and `truck_run_slots` without a company filter. It only triggers refetches that are themselves scoped, so no foreign data is shown; adding the same `company_id=eq.` filter used on the Dispatch Board is a one-line change per subscription and will be included.

## Guarantees

- No same-company data is hidden: every filter matches the company the user is already working in, which is what their access rules allow anyway.
- No access-rule (RLS) change, no creator cross-tenant policy change, no billing math, no claims generation, no files outside `src/pages/DispatchBoard.tsx` and `src/pages/TripsAndClinical.tsx`.

## After building

Type check, full test run, and a Dispatch Board + Trips page load to confirm the same runs, crews and alerts still appear.
