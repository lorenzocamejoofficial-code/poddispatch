# Plan — Make the denial rework loop testable

Two fixes only. The `escalated_denials` escalation feature is parked and not part of this.

---

## FIX 1 — Injected denial claims get a real trip behind them

### Why
`createDenialsRemitsClaimPool` (`supabase/functions/simulation-lab/index.ts:1723-1749`) inserts `claim_records` with no `trip_id`. The Denial Recovery Engine loads trip data only when `claim.trip_id` is set (`DenialRecoveryEngine.tsx:195-214`), and the Claim Field Corrections editor renders only when `tripData` is non-null (`:620`); `saveFieldCorrections` early-returns without it (`:280-283`). So the one surface where a biller actually *works* a CO-16 / CO-11 denial never appears on injected data.

### What changes
Inside `createDenialsRemitsClaimPool`, before inserting claims, create one `trip_records` row per pooled claim and set `claim_records.trip_id` to it.

Applies to **every** pooled claim, not just the field-editable codes. Rationale: it is the same loop of code either way, and a trip-backed claim also makes the paid / aging / timely-filing buckets behave like real claims (the `demoteBlockedReadyToBill` safety net in `BillingAndClaims.tsx:899-903` skips trip-less claims today, so trip-backing quietly restores that check too). Carving out CO-16/CO-11 only would add branching for no saving.

**Trip fields carried** (mirroring what the main seeder already writes at `index.ts:806-848`, so nothing new is invented):

- Identity/scope: `company_id`, `patient_id` (same patient the claim uses), `run_date` (matches the claim's `run_date`), `status: 'ready_for_billing'`, `trip_type: 'dialysis'`, `transport_category` (NOT NULL — set `'dialysis'`), `pcr_status: 'submitted'`
- The fields `FIELDS_FOR_DENIAL` edits (`DenialRecoveryEngine.tsx:126-133`): `icd10_codes`, `member_id`, `dispatch_time`, `at_scene_time`, `left_scene_time`, `arrived_dropoff_at`, `in_service_time`, `origin_type`, `destination_type`, plus `service_level` for the CO-4 case
- Fields the readiness gate reads through `fetchClaimBlockerSnapshot` (`claim-blockers.ts:89-98`): `loaded_miles`, `signature_obtained`, `pcs_attached`, `loaded_at`/`dropped_at`, `patient_mobility`, `stretcher_placement`, `odometer_at_destination`
- Payer linkage: `primary_payer`, `member_id` matching the claim row
- Chronological timestamps derived from the claim's own `run_date` (not today), so PCR timestamp-integrity rules hold

`leg_id` stays **null** — nullable in the schema, no `scheduling_legs` row needed. The blocker snapshot's leg join is a left join and already handles null (`claim-blockers.ts:93`, `:106`).

Values stay consistent with `CLEAN_CLAIM_FIELDS` (`index.ts:1682-1691`) so a denied claim is otherwise complete and the denial is genuinely the only thing to work.

### Guards
Every new trip row carries `is_simulated: true` and `simulation_run_id: runId`, same as the seeder. The claim rows keep their existing treatment (`is_simulated` flipped to false at bucket time so the Missing Money scanner and billing board see them, `index.ts:1822`, tagged with `simulation_run_id`). `is_test_submission` stays false, unchanged.

### Reset coverage — needs widening (bug found)
`resetSandbox` (`index.ts:1522-1612`) deletes `trip_records` where `is_simulated = true` inside the table loop (`:1538-1557`), so the new trips *are* swept. But the ordering is wrong for the claims that point at them: injected claims are `is_simulated = false`, so they are missed by the loop and only deleted afterwards at `:1563-1568` — i.e. **after** `trip_records` has already been deleted. Today that's harmless because injected claims have no `trip_id`; once they do, the trip delete will hit the `claim_records.trip_id` foreign key and the reset will fail or silently leave rows behind.

The fix: move the tagged-claim sweep (`:1563-1568`) to run **before** the `tables` loop, so claims go first and trips second. No other reset change is needed.

### Verification after build
Reset → Inject → confirm each denied claim has a non-null `trip_id`, open one CO-16 denial and confirm the Claim Field Corrections editor renders with populated values, edit a field, save, confirm the write lands on `trip_records` and a `billing_overrides` row is logged. Then Reset again and confirm zero orphan trips/claims remain.

---

## FIX 2 — A failed blocker read must not read as "clean"

### Why
`fetchClaimBlockerSnapshot` (`src/lib/claim-blockers.ts:66-133`) discards the query error and returns `{ claim: null, blockers: [] }` when the claim row can't be read (`:69-75`). An empty blocker list is the exact signal for "clean", so an RLS denial or a network blip currently reads as "safe to resubmit" — and `handleMarkReady` would promote the claim to `ready_to_bill` on that false-clean.

### The change
Add a third field to the return so error and clean are distinguishable:

```ts
{ claim: any | null; blockers: ReadinessIssue[]; ok: boolean }
```

`ok: false` when the claim query returns an error **or** no row (both mean "could not verify"). `ok: true` only when a row was genuinely read and the rules ran. The patient/trip enrichment reads stay best-effort as today — they already degrade gracefully via `??` fallbacks and a missing patient row is not the same as a missing claim.

No change to `detectClaimBlockers` or `evaluateClaimReadiness` — one source of truth for the rules stays exactly where it is.

### Consumers — all of them (verified by search, there are only two)

Both live in `src/components/billing/DenialRecoveryEngine.tsx`; nothing else in the codebase imports this function.

1. **`refreshBlockers` (`:249-256`)** — the live blocker list. On `ok: false`, keep the previous blocker list rather than blanking it to the green "structurally clean" panel (`:533-539`), and show a small "Couldn't verify — check your connection and re-check" line next to the Re-check button. It must never render the green all-clear off a failed read.
2. **`handleMarkReady` (`:365-443`)** — the resubmission gate. On `ok: false`, toast an error ("Couldn't verify this claim's blockers — nothing was changed. Try again."), leave the claim `denied`, and return before any write. Only an `ok: true` result with zero blockers may proceed to the status promotion at `:393-397`.

### Scope guard
No change to pricing, 837 export, the submit path, `claim-status-tabs.ts`, the `needs_correction` behaviour, or the honest-status trigger.

---

## Files touched

- `supabase/functions/simulation-lab/index.ts` — trip creation in `createDenialsRemitsClaimPool`, claim-sweep ordering in `resetSandbox`
- `src/lib/claim-blockers.ts` — `ok` flag on the snapshot return
- `src/components/billing/DenialRecoveryEngine.tsx` — both consumers honour `ok`

Test suite (including the parity tests) re-run before reporting done.
