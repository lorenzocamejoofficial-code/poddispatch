# Batching recommendation for the punch list

This is a planning answer, not a build. I re-read all seven spots in the live code before writing it.

## 1. Capacity — the honest number

Three passes. Not one, not seven.

Five of the seven items are the same defect ("a write failed and the screen said it worked") in five unrelated files with no shared state, no schema change, and no shared test. Those are genuinely safe together — the risk of one masking another is near zero because none of them import each other.

The two that must stand alone are employee deletion (it needs new server-side code with elevated privileges and touches login accounts) and the clearinghouse toggles (the real issue there isn't a silent failure — see below).

## 2. Natural batches

### Pass A — "failed write must not report success" (5 items, one pass)

| Item | What's actually there now | Fix |
| --- | --- | --- |
| ePCR field saves (`src/hooks/usePCRData.ts:344-412`) | Debounced save; on error only `console.error`. Applies to `updateField`, `updateMultipleFields`, and `recordTime`. | Show a visible failure, roll the on-screen value back or mark it unsaved, and offer retry. |
| PCR submit (`src/pages/PCRPage.tsx:1391-1406`) | Update result is never read; success is assumed. | Read the result, stop and show the real reason on failure. |
| Board drag-reorder (`src/pages/Scheduling.tsx:1006-1016`) | `Promise.all` of slot updates, results discarded — comment literally says "fire and forget". | Check each result; on failure revert the optimistic order and say so. |
| Inspection alerts (`src/components/inspection/CrewInspectionChecklist.tsx:161-181`) | Alert-row and dispatch-alert inserts unchecked, then unconditional "Inspection submitted successfully". | Check inserts; if the dispatcher alert didn't post, say the inspection saved but dispatch wasn't notified. |
| Payer rule save (`src/pages/ComplianceAndQA.tsx:60-75`) | Insert/update result discarded, always toasts "Rule saved", closes dialog. | Check result; on failure keep the dialog open with the typed values and show why. |

Why these group cleanly: identical shape of change (capture the result, branch on error, keep the user's data), five separate files, no schema work, no shared component. Grouping also keeps the wording and behaviour consistent instead of five slightly different error styles.

Two internal notes that keep this honest: the ePCR one is the largest because the save is debounced and per-field — a failure arrives after the user has moved on, so it needs an "unsaved" marker, not just a toast. And the inspection one has two writes with different consequences (the record vs. the dispatcher notification), so its message has to distinguish them.

### Pass B — employee deletion (stands alone)

`src/pages/Employees.tsx:469-498` (single) and `:499-...` (bulk) delete only the `profiles` row. There is no `manage-employee` server function today — the closest existing ones are `delete-pending-crew-member`, `update-crew-member`, `create-user`. So this pass means writing new privileged server code that removes the login account, company membership, and role together, decides archive-vs-hard-delete, and handles what happens to that person's past trips and signed charts.

Why it can't ride along with Pass A: new server code, elevated privileges, access-rule implications, a real destructive-action decision (deleting a crew member who signed charts is not the same as removing a typo account), and it needs its own confirmation gate. Mixing a destructive identity change into a five-file feedback pass is how a bad delete slips through review.

### Pass C — clearinghouse toggles (stands alone, and needs a decision first)

`src/components/settings/ClearinghouseSettings.tsx:412-463` — the two switches set local state only; there **is** a "Save Settings" button below them that does persist both. So this isn't a dead button or a silent failure; it's a flip-that-looks-live-but-isn't until you scroll and press Save. Two possible fixes, and I want your call rather than a guess:

- make the switches save immediately (and revert visibly if the save fails), or
- keep the Save button and make the pending state obvious ("unsaved changes").

Also this one governs whether real claims auto-transmit to Office Ally, so it deserves its own verification rather than being buried in a five-item batch.

## 3. Recommended order

1. **Pass A** — biggest customer-visible risk (lost charting, a run order that silently reverts), no schema work.
2. **Pass B** — employee deletion, after we settle archive vs. delete and what happens to their historical records.
3. **Pass C** — clearinghouse toggles, after you pick the behaviour.

## 4. What you'd click to verify

**Pass A** — the reliable way to prove a failure path is to go offline (browser dev tools → Network → Offline) or turn off wifi for a few seconds, because none of these fail on a healthy connection.

- ePCR: open a chart, type into a vitals field, kill the connection, type another field. Expect a visible failure and an unsaved marker — not a clean-looking form. Reconnect and confirm it recovers or lets you retry.
- PCR submit: complete a chart in the sandbox and submit normally (should still work), then submit with the connection killed — expect a clear error, and the chart must NOT show as submitted.
- Board reorder: drag two runs on one truck to reorder, offline. Expect the order to snap back with a message. Then do it online and reload the page to confirm the new order stuck.
- Inspection: run a pre-trip check in the crew app with one item marked missing — confirm the red alert lands on the dispatch board. Repeat offline and expect an honest failure message.
- Payer rule: edit a payer rule, save offline — expect the dialog to stay open with your typing intact and a real error. Save online and confirm the row changed after a reload.

**Pass B** — create a throwaway employee, delete them, then confirm: they're gone from the employee list, they can no longer log in, they no longer appear in crew assignment dropdowns, and any trip they previously touched still shows their name in history. Also test bulk delete with two throwaway accounts.

**Pass C** — flip both switches, leave the page without saving, come back: state should match whatever behaviour we choose. Then set them deliberately, reload, and confirm they held.

## 5. What I would not touch in these passes

Claims/837 generation, denial recovery, trial timers, tenant access rules, and Stripe prices. None of the seven items requires going near them.
