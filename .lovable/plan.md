# Review & Release Submission + Hard Live/Test Separation

## Part B first: what decides live vs test (findings)

**The authoritative flag is on the company row.** `companies.is_sandbox` and
`companies.creator_test_tenant` are both `boolean NOT NULL DEFAULT false`, so they can
never be null or ambiguous. A company created through signup/approval
(`create-company`, `company-signup`) never sets either one, so every real customer is
`false/false` by construction. Only creator-side sandbox/simulation creation sets them.
Today there are exactly two companies: Lorenzo Test Company (both true) and Test
Ambulance LLC (both false). This is a trustworthy single source of truth. I will treat
**`is_sandbox OR creator_test_tenant` = TEST company; everything else = LIVE company**,
matching the definition already used by `useIsSimulationCompany` and `fetchRealCompanyIds`.

**Today's rule (`src/lib/queue-claims-for-submission.ts:89-106`):**

```
const isSandboxCompany = !!(company as any)?.is_sandbox;
let hasSimulatedClaim = false;                       // probes claim_records.is_simulated
...
const forcedTest = isSandboxCompany || hasSimulatedClaim;
const testMode = opts.testMode ?? (forcedTest || !!(vendor as any)?.test_mode);
```

Three problems:
1. Batch-content blending — one simulated claim flips the whole envelope to T.
2. `creator_test_tenant` is not consulted, only `is_sandbox`.
3. **The live bug:** `vendor_clearinghouse_settings.test_mode` is currently `true` (single
   global row). So *a real customer submitting today would go out as ISA15=T* — Office
   Ally would validate but never pay. This is the most dangerous finding in the audit.

**New rule — company type decides, nothing else:**

```
const isTestCompany = !!company.is_sandbox || !!company.creator_test_tenant;
const testMode = isTestCompany;      // real => false (ISA15=P), always
```

- `opts.testMode` is no longer honoured for real companies; for a test company it cannot
  turn test *off*. The global vendor `test_mode` no longer influences a real tenant.
- The "any simulated claim forces test" probe is removed.
- **Safety net instead of blending:** in a real company, any claim with
  `is_simulated = true` is *blocked* with a readiness issue ("Simulated claim cannot be
  submitted from a live company") and excluded from the file — the rest still go live.
  Confirmed today this can't normally happen: a query for simulated claims inside
  non-sandbox, non-creator-test companies returns **0 rows**, and simulation seeding
  always targets sandbox tenants. The block is a guard, not a routine path.

**Is any test path reachable by a real tenant?** No, and it stays that way.
`EDIExport.tsx:294-308` already forces `usage_indicator = "P"` and only enables the test
toggle when `isSystemCreator`; the "Submit Single OATEST Claim" button and the TEST/LIVE
badge are behind `isSystemCreator` (:1450, :1507). The tenant Clearinghouse tab was
already removed. The one remaining leak is the vendor `test_mode` flag reaching real
tenants through `queueClaimsForSubmission` — closed by the change above. No new toggle
is added anywhere in the tenant UI.

**Truthful labeling.** `BillingAndClaims.tsx:1510` hardcodes "Office Ally (live)". The
review dialog will read the company type once and show either a green **LIVE — real
claims to payers** line or an amber **TEST (OATEST) — sandbox company, nothing is
billed** line, both in the summary block and in the dialog title/description.

## Part A: review and release

Replace the one-press batch at `BillingAndClaims.tsx:1488-1525`.

- "Submit Claims to Payers" opens a **release review dialog** listing every
  `ready_to_bill` claim plus every `blocked_payer_mapping` / validation-blocked claim.
- Each releasable row: checkbox (checked by default), patient, payer, run date, amount,
  and any warning chip.
- Blocked rows appear in the same list, greyed, not selectable, with their plain-English
  reason and a "Fix" link that opens that claim's drawer — no silent skipped count.
- Sticky summary bar: "X of Y selected · $total · N payers", plus the LIVE/TEST banner.
- One **Release Selected** action using the existing `ConfirmActionDialog` (type
  `SUBMIT`) — for a live company the copy says claims go to payers and cannot be unsent.
- The single-claim button in the drawer (`:2241`) drops `window.confirm` and uses the
  same `ConfirmActionDialog` with the same LIVE/TEST line.
- **Honest post-state:** success copy becomes "N claims queued for upload (file X) — the
  clearinghouse worker uploads within a few minutes" rather than implying it already
  left. The claim board keeps its existing `submitted` transition, but the drawer/row
  shows "Queued — awaiting upload" until the queue row flips off `pending`, read from
  `claim_submission_queue.status`.

## Technical notes

- `queue-claims-for-submission.ts`: replace lines 89-106 with the company-type rule
  (select `creator_test_tenant` alongside `is_sandbox`), add the simulated-claim block
  inside the per-claim loop, and keep everything else — generator call, queue insert,
  `is_test` / `is_test_submission` stamping, audit note — unchanged.
- New component `src/components/billing/ReleaseReviewDialog.tsx`; `handleSendViaOA`
  becomes `releaseClaims(selectedIds)` and is called from it.
- New tiny helper `src/lib/submission-mode.ts` exposing
  `fetchSubmissionMode(companyId) -> { isTest: boolean }` so the dialog label and the
  queue function agree on one definition.
- Not touched: 837P generation, the SFTP worker, denial recovery, trial, Stripe,
  RLS/tenant isolation, pricing and claim math.

## Verification

Typecheck, full test run, plus a claim-parity check that a real-company file still
carries `ISA15=P` and a sandbox file `ISA15=T`.
