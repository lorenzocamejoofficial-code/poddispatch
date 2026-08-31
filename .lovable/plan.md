# Bring automated Office Ally 835 retrieval to parity with manual upload

Today the automated pull uses a hand-rolled "minimal parser" that reads only `NM1*85` and `CLP`. It never reads `CAS`, so denials arrive with no CARC/RARC, no `denial_reason`, no `claim_payments` row, and no PLB capture. Manual upload does all of it. This plan makes the two paths produce identical data.

## 1. One parser, shared by client and edge function

The edge bundler only uploads files under `supabase/functions/`, so the Deno function cannot import `src/lib/edi-835-parser.ts` directly. The project already solved this exact problem for NEMSIS: `scripts/sync-nemsis-to-edge.sh` copies `src/lib/**` into `supabase/functions/_shared/` and rewrites relative imports to add `.ts` extensions.

Recommendation: reuse that pattern rather than rewriting or duplicating logic by hand.

- Add `scripts/sync-billing-to-edge.sh` (same shape as the NEMSIS script) that copies:
  - `src/lib/edi-835-parser.ts` → `supabase/functions/_shared/edi-835-parser.ts`
  - `src/lib/denial-code-translations.ts` → `supabase/functions/_shared/denial-code-translations.ts`
  - `src/lib/payer-compliance.ts` → `supabase/functions/_shared/payer-compliance.ts`
- `src/lib/edi-835-parser.ts` stays the single source of truth and is edited only there. The `_shared` copies are generated artifacts with a "generated — do not edit" header.
- The edge function imports the `_shared` copies. Both paths then call the same `parseEDI835Envelope`, `extractCO45WriteOff`, `getPrimaryDenialCode`, `mapToEventType`, `parsePatientControlNumber`, `isValid835`.

All three modules are pure TypeScript with no browser/Supabase-client dependencies, so they run unchanged under Deno.

## 2. Unified claim matching (quarantine preserved)

Current manual matching (`RemittanceImport.tsx`): CLP01 patient-control-number prefix → member ID + date of service → charge-amount tiebreak on multiples.
Current auto matching: `payer_claim_control_number` equality only — which is the payer's own number, frequently absent on a first remittance, so most auto CLPs fall straight into quarantine.

Change: extract the matching function into a shared helper (`_shared/remittance-match.ts`, mirrored from a new `src/lib/remittance-match.ts` so the client uses the identical code) that takes the parsed claims plus the company's candidate `claim_records` and returns `{ matchedClaimId, matchedPatientId, errors }` using the manual precedence order, with `payer_claim_control_number` added as a first-tier check before the CLP01 prefix.

Quarantine behavior is unchanged and still runs first:
- NPI mismatch (file NPI vs importing company NPI) → `remittance_quarantine`, never posted.
- No match after the full ladder → `remittance_quarantine` with the existing reason text and file back-fill.

## 3. Write path: `claim_payments` + trigger, not a direct `claim_records` update

Replace the auto path's direct `claim_records` update with the same insert manual does:
`claim_record_id, company_id, event_type, clp_status_code, amount, patient_responsibility, write_off, allowed_amount, denial_code, denial_reason, adjustment_codes, cas_adjustments, payer_claim_control_number, remittance_file_id, payment_date, is_simulated`.

Safety: this is safe and strictly better. `recompute_claim_from_payments` already writes `amount_paid`, `patient_responsibility_amount`, `write_off_amount`, `allowed_amount`, `denial_code`, `denial_reason`, `denial_category`, `paid_at`, `remittance_date`, `payer_claim_control_number`, `adjustment_codes`, and `status` from the payment rows — a superset of the thin update. Keeping both would be a double-write: the direct update writes `status` from CLP02 while the trigger derives it from the payment ledger, and the two disagree (e.g. CLP 3). So the direct `claim_records` update is removed entirely, exactly as the manual path does. The PR cap and its audit log move onto the `claim_payments.patient_responsibility` value via the shared `capPatientResponsibility` helper, so the cap is applied before the trigger aggregates.

Also carried over from manual: `remittance_files` gains the envelope fields (`bpr_total_paid`, `payment_date`, `payer_name`, `eft_trace_number`, `reconciled`, `reconciliation_variance`) instead of only counters.

## 4. PLB capture

Parse provider-level adjustments from the envelope and insert `plb_adjustments` rows (`remittance_file_id`, `company_id`, `provider_npi`, `fiscal_period`, `reason_code`, `reference_id`, `amount`, `is_simulated`), matching manual. Reconciliation variance is computed as BPR02 vs (sum of claim payments + sum of PLB), same formula the manual path uses.

## 5. Simulation guards stay intact

- `is_simulated` on the auto path is derived server-side from the company row (`creator_test_tenant` / `is_sandbox`), not from request input.
- `guard_simulated_payment` stays untouched and continues to reject `is_simulated = true` on real tenants.
- `recompute_claim_from_payments` keeps its rule that a claim only becomes simulated when every payment on it is simulated.
- `useIsSimulationCompany` is client-side and unchanged.

## Out of scope

Manual upload UI, blocker rules, the denial classifier, the submit path, and the recent `needs_correction` fix are untouched. The trigger's CLP-3 handling is identical for both paths after this change, so no new divergence is introduced (it is a pre-existing behavior, left as-is).

## Verification after build

- Typecheck plus the existing billing/parity test suites.
- A drift test asserting each `_shared` copy is byte-identical to its `src/lib` source apart from the generated header and `.ts` import extensions, so the two parsers cannot silently diverge again.
- Feed the same synthetic denial 835 through both paths and confirm the resulting `claim_payments` / `claim_records` rows match field for field.
