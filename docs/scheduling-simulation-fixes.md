# Contained scheduling and simulation fixes

## Changes
- Trucks & Crews excludes people already assigned on the same date from other trucks' member selectors. Editing retains the current crew's people; sibling member selections are excluded. Unassigning restores availability after refresh. Manual Create PCR uses the same filter against the selected day's company-scoped crews. Existing assignment validation and atomic RPC remain unchanged.
- The other assignment pool found (Truck Builder's run selector) already uses unassigned legs. Truck selectors used to add multiple runs and lookup/recipient selectors are reusable resources, not exclusive crew slots, and remain unchanged.
- Extend Week Forward now treats the selected start as a seven-day source range without Sunday snapping. Destination dates begin immediately after its end, repeat the seven-day offsets in match mode, and stop at the actual horizon (including December 31). Preview and writes use the same date helper. This control copies crew assignments, not patient runs; no recurring-run generation was added.
- Both creator simulation entry controls call the existing guarded `enter_creator_simulation` RPC and hard-navigate to `/dispatch`. The old system button used generic company switching, which navigated to `/`; creator landing then redirected it to `/system`. Creator routing already bypasses expired-subscription gates, so no subscription changes were necessary.

## Verification
- All 1,361 tests passed with two workers; the initial default-concurrency run had a secondary-flow timeout, and both the focused retry and full lower-concurrency suite passed without changes to billing code or tests.
- Latest automatic typecheck/build: build OK.
- Synthetic browser interaction checked assigned-person and sibling-seat exclusion, source Nov 19–25 copying from Nov 26 with weekday pattern preserved, source/destination display at desktop/mobile sizes, and guarded simulation entry staying on `/dispatch`. No runtime errors in the completed check.
- No PHI, RLS, billing/COB calculations, NEMSIS code, migrations, or tenant settings changed.

## Limitations requiring follow-up
- Real-account end-to-end verification unavailable: self session mint could not match the requester and explicit account mint was unavailable in this context. Synthetic checks do not establish authenticated production behavior.
- Both existing entry controls hardcode **Lorenzo Test Company**, which is sandbox/test flagged. The separately named **Test Ambulance LLC** is neither sandbox nor creator-test flagged. Its settings were not changed and it was not made eligible for guarded simulation entry. Confirm the intended destination before changing this safety boundary.

## Consistency sweep
Rule: assigned people and run legs leave exclusive same-day pools; extensions start after their source; simulation entrances share the same guarded destination.

| Place read | Result |
| --- | --- |
| Trucks & Crews, all three member selectors, edit/save/clear handlers | Same-day and sibling-seat filtering; existing save conflicts retained; clearing refetches pool. |
| Office Create PCR, both crew selectors and manual-pcr creation | Same filter, scoped daily query, existing crew reuse, guarded assignment on creation. Source-read, not browser-verified in this sweep. |
| Truck Builder Add Leg selector, assignment handler and refresh | Only unassigned legs; unique-conflict feedback and refresh after success. Source-read. |
| Scheduling RunPool, drag assignment/unassignment, shared store | Pool supplied from unassigned legs; optimistic assignment/unassignment; completed moves blocked; unique conflict rolls back. Source-read. |
| Trucks & Crews Extend Week Forward | Shared contiguous source/destination range; no Sunday snapping. Added maximum dialog height and scrolling so confirmation remains reachable on short phones. |
| Scheduling Copy Crew Assignments Forward | Defaults to day after viewed week; explicit alternate target week is a different supported workflow. Source-read. Drops third-member fields and does not explicitly handle query/insert errors; these are adjacent existing defects, not silently repaired. |
| Recurring Auto-Fill in scheduling store | Generates eligible A/B legs only for selected date, skips existing patient/leg types; does not assign crew or extend ranges. Source-read. |
| Creator dashboard button and creator menu | Both call guarded simulation helper, then hard-load dispatch. Source-read; dashboard button browser-tested synthetically. |
| Index, App creator/expiry routing, useAuth company switch | Creator root redirects to system; explicit dispatch avoids it; expired gate excludes creator. Generic company switching deliberately remains a root reload, not simulation entry. Source-read. |
| CompanySwitcher, SelectCompany, AdminLayout Simulation Lab link | Company selection retains generic behavior; Simulation Lab is a separate control-room link, not tenant entry. Source-read. |
| Database safe_assign_crew six-argument function and older overload migration | Same-seat and same-day cross-truck checks in function bodies. Existing routines unchanged; migration source read, hosted definitions not revalidated. |
| Database truck_run_slots definition | Unique (leg_id, run_date) prevents duplicate assignment. Migration source-read. |
| Database enter_creator_simulation | Creator-only, non-deleted sandbox/test company; membership/profile context is persisted; no expired gate. Migration source-read. |
| manage-employee future assignment cleanup | Removes archived employee seats from future assignments, preserves history. Source-read. |
| simulation-lab seeding and oatest-run setup | Reuse crews rather than create crew assignments; synthetic legs have distinct ids. Selected sections read; no job executed or example data changed. |
| crew-run-sheet and Crew Schedule Delivery | Read/display assigned crews; truck choices are reusable run-sheet/recipient selections, not exclusive assignment slots. Source-read. |

The copy-forward paths use direct crew inserts rather than safe_assign_crew, so their treatment of an employee already on a different target truck is not established by the RPC check. No database guard or permission changes were added: that warrants a separate approved assignment-integrity change.

Final verification: four synthetic browser runs (390/1280 widths, light/dark) passed with zero runtime errors; source Nov 19–25 produced first copied date Nov 26. All 1,361 tests passed again; latest automatic build/typecheck was OK. This is not complete real-account coverage or an executed background-job/database-function audit.