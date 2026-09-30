# Unify the Cancel Workflow (plan only)

## What changes for users
- Every "Cancel" button gives the same result: Scheduling, Truck Builder, and the Flag menu in Trips & Clinical.
- Each one asks for a reason, notifies the crew and the office, and logs the cancel.
- If the crew already started a report, they must always fill out the cancellation form.
- If a claim already exists, it is handled right away instead of waiting for a biller scan.

## Decision: one shared cancel function, with the dialog as the only screen
- **Shared function:** new file `src/lib/cancel-trip.ts` with one function, `cancelTrip()`. It holds all the cancel logic now inside `DispatcherCancelDialog.handleSubmit` (lines 44-193).
- **One dialog:** `DispatcherCancelDialog` becomes the only cancel screen. It keeps its reason picker and notes, then calls `cancelTrip()`. The screen and the logic are both shared, so they can't drift apart.
- **Why not reuse the dialog alone:** the Truck Builder return-leg cascade needs to run the logic twice without opening a second screen. The logic has to be callable on its own.
- **Why keep the dialog's screen:** you asked for the same styled confirm-with-reason. The dialog already has it (reason required, notes, "crew notified by phone" checkbox).

## What `cancelTrip()` does, in order
1. Find the trip by its ID, or by leg + date. If there is no trip yet, create one already marked cancelled. Same as the dialog today (`:57-106`). Always stamped with the active company.
2. **Report rule (the only place it lives):** if the report was in progress or submitted, mark the trip "cancelled with report." That forces the crew cancellation form.
   - It never downgrades a report already marked "cancelled with report" or "documented."
   - A report that was never started stays "not started."
3. Mark the trip cancelled with reason, who, when, and source ("dispatcher", "trips_clinical" or "truck_builder").
4. Mark the truck slot cancelled for that leg and date.
5. **Existing claim** (details below).
6. Notify the crew on that truck and the other dispatchers and owners. Add the Dispatch Board alert. Write the audit entry.
7. Return the result (trip, report status, what happened to the claim) so the caller can show one accurate message.
8. Every database write checks its error. A failed write throws, so nothing reports success when it didn't save (keeps the earlier "no false success" rule).

## How each entry point changes
- **Scheduling** (`Scheduling.tsx` → `DispatcherCancelDialog`): no change in behavior. The dialog now calls `cancelTrip()` inside.
- **Truck Builder** (`TruckBuilder.tsx` `cancelLeg`, lines 484-543):
  - This quiet version only runs when no dispatcher cancel handler is passed in (`:641`, `onDispatcherCancel ?? cancelLeg`).
  - It gets replaced by opening `DispatcherCancelDialog`.
  - When a pickup leg is cancelled, the dialog cascades to the paired return leg with the same reason, via a second `cancelTrip()` call. Trucks, the audit entry, and the schedule-change log stay as they are.
  - When Scheduling does pass its handler, that handler also cascades the return leg, so both routes behave the same.
- **Trips & Clinical Flag → Cancel** (`TripsAndClinical.tsx` `markSpecialStatus`, lines 464-479):
  - The "cancelled" choice stops writing the status directly. It opens `DispatcherCancelDialog` with the trip's ID, leg, truck and date.
  - No-show, patient not ready, and facility delay are unchanged.
  - The "review claims" warning is replaced by the real claim result from `cancelTrip()`.

## Documentation is guaranteed on every path
- Only `cancelTrip()` can set a trip to cancelled from the office side, and it always applies the report rule.
- A search after the change confirms no other office screen writes a cancelled status directly.
- **Kept on purpose:** the crew's own cancel request (pending → Confirm Cancel) is a separate flow you said not to touch.
  - I found that Confirm Cancel (`PendingCancellationPanel.tsx:41-48`) sets the trip cancelled without the report rule.
  - I'll leave that file alone and list it as an open item for you to decide. Say the word and I'll fold it into this pass.

## Existing claim at cancel time: reuse the void, with one real problem
- **The logic reused:** the billing scan (`BillingAndClaims.tsx:1214-1235`) finds non-voided claims for cancelled trips and sets them to "voided" with the note "Trip was cancelled, claim voided automatically".
- **How it's reused:** I'll move that step into one helper, `voidClaimsForCancelledTrip(tripId)`, in `cancel-trip.ts`. Both `cancelTrip()` and the billing scan will call it, so the note and rules are identical in both places.
- **Problem found:** "voided" is not an allowed claim status in the database. The allowed list is ready to bill, submitted, paid, denied, needs correction, needs review, pending, reversal, forwarded, blocked payer mapping. So today's scan void most likely fails silently, and the result isn't checked (`:1227-1230`).
  - **Fix:** add "voided" to the allowed claim statuses. This is a small database change that only adds a value and doesn't change any existing claim.
  - Without it, cancel-time voiding cannot work.
- **Safety rule:** only void claims that have not left the building (ready to bill, needs review, needs correction, pending, blocked payer mapping).
  - Claims already submitted, paid, forwarded, denied or in reversal are **not** voided. Those need a payer correction, not a silent status change.
  - Instead they get flagged to the billers ("Trip cancelled after claim was sent — review") through the existing biller notice, and the cancel message says so.

## Not touched
- The crew cancel-request flow and the cancellation form's contents.
- The standing weekly schedule: only that day's trip and slot are cancelled, so the run comes back next cycle.
- No hard deletes. The existing "remove leg" action is not changed.
- Pricing and 837 file creation, denial recovery, security rules and company separation, trial/lifecycle, founding.
- The only billing change is moving the scan's existing void step into the shared helper.

## Technical details
- **Files:**
  - `src/lib/cancel-trip.ts` (new)
  - `DispatcherCancelDialog.tsx` (calls the helper; new `source` prop and optional return-leg cascade)
  - `TruckBuilder.tsx` (fallback `cancelLeg` opens the dialog)
  - `Scheduling.tsx` (cascade the paired return leg)
  - `TripsAndClinical.tsx` (Flag → Cancel opens the dialog)
  - `BillingAndClaims.tsx` (scan calls the shared void helper)
- **Database change:** `ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'voided';`. Screens that list claim statuses will show "Voided" as a label.
- **Checks:** the claim-void rules get tests (which statuses void and which get flagged). I'll also test end to end on a sandbox company: cancel a started report from each of the three places, confirm the crew sees the required form, and confirm a ready-to-bill claim turns voided.

## Open item for you
- Should the crew's own "Confirm Cancel" (`PendingCancellationPanel`) also apply the report rule and handle the claim? It's excluded right now because you asked me not to touch that flow.
