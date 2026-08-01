# Ordered build: safety, crew integrity, and billing guards

Three items are already done in this pass (no approval needed, shipped):

- Onboarding checklist stale gating — now reads the live 6-step total instead of a hardcoded 5, and the chips match the real wizard steps (company info, rates, trucks, crew, facility, patients). The retired clearinghouse step no longer blocks completion.
- Cert-queue back navigation — "Back to Employees" button on the Certification Review Queue.
- Re-pend notification — when a crew member self-edits an approved certification and it re-pends, every owner/manager/dispatcher now gets a notification.

The cert-level enum change (add EMR, remap AEMT to EMT-A, drop Other) and truck unit level (BLS/ALS at creation) were already completed in earlier passes; both are verified in the database.

## Order and rationale

Work moves outward from data truth -> operational rules -> display -> cleanup. Nothing in this plan changes how a claim is priced or coded; the billing pipeline stays byte-identical except where a new guard blocks a bad claim from leaving.

### Phase 1 — Crew integrity (driver/attendant + minimum crew)

1. Add `role_on_truck` ("driver" | "attendant") per crew slot on the daily truck assignment.
2. Minimum-crew rule: a valid crew is one driver plus at least one non-EMR attendant. Two EMRs is invalid. EMR is driver-only.
3. Assignment is blocked when invalid, with an OVERRIDE gate: owner/manager types OVERRIDE plus a reason, written to the override monitor with the crew composition captured.
4. Derived unit capability = min(crew capability, truck service level). Display and dispatch only — never read by billing.

### Phase 2 — PCS-vs-condition mismatch (the pitch feature)

A shared rule module compares what the PCS asserts (wheelchair / ambulatory / stretcher / bed-confined) against what the run documents (mobility, stretcher placement, transport type, PCR assessment).

Hard block everywhere:
- Scheduling: cannot save a run whose transport mode contradicts the PCS on file.
- Dispatch: mismatch badge on the truck card, run cannot be started.
- PCR: blocked at submit with the specific contradiction named.
- Claim readiness: block-severity issue so it can never reach Office Ally.

Same OVERRIDE gate pattern as crew, since a legitimate condition change mid-cycle has to be documentable.

### Phase 3 — Money guards

5. Pricing seed guard: a claim whose matched charge_master row is $0 or `needs_review` gets a block-severity readiness issue with a "Fix rates" link, so a company whose ZIP missed the locality table cannot submit $0 claims.
6. Payer taxonomy cleanup: the charge-master dropdown stops listing payer types seeding never creates, and self-pay is added to the signup payer mix so the rates step can actually be satisfied.

### Phase 4 — Integrity sweep

7. Facility name uniqueness per company (real risk — dropoff matches by name), truck name/unit uniqueness per company, and a patient duplicate warning on name plus DOB.
8. Company cert-records export: CSV of every certification with entered-by, approved-by, level, numbers, and dates, for state audits.

### Phase 5 — Display polish

9. Truck unit-level pill, per-person level and role in the assignment view, "EMR — driver only" chip, invalid-crew red block styling.
10. First-login Quick Tours on the crew side.
11. Fix the "Return 12:30:00" scheduling mislabel.
12. Extend the inline field-error styling used for email/NPI across the remaining forms.

## Deliberately not doing

- `step_facility_added` persisted column — the live facility count already drives it correctly; a column adds a second source of truth for no gain.
- ZIP validation on free-text address fields — needs discrete ZIP inputs first. Revisit when the address fields are split.

## Technical notes

- Crew role and override reason live on the existing daily truck assignment rows; the safety-matrix evaluator is extended rather than duplicated.
- PCS mismatch lives in one module consumed by scheduling, dispatch, PCR, and `claim-readiness.ts`, so the four surfaces can never disagree.
- Every claim-readiness addition is covered by the existing parity test harness to prove the 837P output for currently-valid claims is unchanged.
