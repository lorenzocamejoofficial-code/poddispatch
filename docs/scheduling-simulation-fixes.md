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