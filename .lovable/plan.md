# AUDIT: Billing status bucketing (read-only, no changes made)

## 1. Tab membership rules — exact filters

All six tabs are rendered from one array and one filter expression. There is no per-tab query; the page loads every claim once and filters in memory.

- `src/pages/BillingAndClaims.tsx:159-166` — `CLAIM_COLUMNS` defines the six tabs.
- `src/pages/BillingAndClaims.tsx:223-226` — the only fetch: `.from("claim_records").select("*").order("run_date", {ascending:false}).limit(1000)` plus `.or("is_simulated.eq.false,is_simulated.is.null")` for non-sim tenants.
- `src/pages/BillingAndClaims.tsx:1541-1550` — the membership logic:
  - `baseList = secondaryFilter ? claims.filter(c => c.status === "paid" && c.patient_secondary_payer && !c.secondary_claim_generated) : claims`
  - `filteredAll = baseList.filter(c => !hideTestClaims || !c.is_test_submission)`
  - counts: `filteredAll.filter(c => c.status === col.status).length`
  - list: `colClaims = filteredAll.filter(c => c.status === activeCol.status)`

| Tab | Exact membership rule | Line |
| --- | --- | --- |
| Ready to Bill | `c.status === "ready_to_bill"` | 1550 (config 160) |
| Submitted | `c.status === "submitted"` | 1550 (config 161) |
| Paid | `c.status === "paid"` | 1550 (config 162) |
| Denied | `c.status === "denied"` | 1550 (config 163) |
| Needs Correction | `c.status === "needs_correction"` | 1550 (config 164) |
| Needs Review | `c.status === "needs_review"` | 1550 (config 165) |

Global modifiers applied before bucketing: test-submission hide toggle (1544), secondary-review filter (1541-1543), simulation scoping (224-235), 25-per-page slice (1551-1554).

`BillingPipelineHeader` (`src/components/billing/BillingPipelineHeader.tsx:17-23, 40-43`) uses the identical `c.status` equality over the same six values.

**Blockers are never part of tab membership.** `detectClaimBlockers` is imported at line 85 and called only at line 1705, inside the card render, to draw an issues badge. It does not move or exclude a claim from any bucket.

## 2. All possible status values

Postgres enum `claim_status` (`src/integrations/supabase/types.ts:6864-6873`, mirrored at 7097-7106):

`ready_to_bill, submitted, paid, denied, needs_correction, needs_review, pending, reversal, forwarded, blocked_payer_mapping`

The page's local TypeScript type only covers six of them (`src/pages/BillingAndClaims.tsx:99`).

**Gap:** `pending`, `reversal`, `forwarded`, `blocked_payer_mapping` have **no tab**. A claim in one of those four states is fetched, counted in nothing, and rendered nowhere on the claims board. Writers that produce them:
- `blocked_payer_mapping` — `src/lib/queue-claims-for-submission.ts:498-506`
- `pending` / `forwarded` / `needs_correction` — DB trigger `recompute_claim_from_payments` (835 posting), CLP status codes `5/13/15/25` → `pending`, `19/20/21` → `forwarded`, reversal with no money → `needs_correction`
- `needs_correction` — `supabase/functions/ingest-acks-officeally/index.ts:213, 297`

## 3. The reported mismatches

### "Ready to Bill has claims with issues"
Three independent writers set `ready_to_bill` with **no blocker check at all**:

1. **DB trigger `auto_create_claim_on_pcr_submit`** — every claim created on PCR submit is hardcoded `'ready_to_bill'::claim_status` (function body line 117) and simultaneously sets the trip `claim_ready = true`, `billing_blocked_reason = NULL`, `blockers = '{}'`. This is the primary creation path and it never consults readiness.
2. **Simulation Lab seeder** — `supabase/functions/simulation-lab/index.ts:1869` and the timely-filing bucket at ~1866-1876 write `status: "ready_to_bill"` directly.
3. **Secondary claim creation** — `src/lib/create-secondary-claim.ts:134` `status: "ready_to_bill" as const`.

Only the two client-side paths gate on readiness: `buildClaimFromTrip` (line 602: `claimStatus = (gateResult.level === "blocked" || "review" || addressIssue) ? "needs_review" : "ready_to_bill"`) and `refreshExistingClaims` (line 771-774). Those only run when a user presses Sync/Refresh.

So: claim status is a *stage marker*, not a *quality verdict*. The card computes blockers at render (1705) and shows them, but the claim still sits in Ready to Bill. That is exactly the symptom reported.

### "Submitted and Paid also have claims with issues"
`submitted` is set by the submission pipeline (`src/lib/queue-claims-for-submission.ts:542`) and `paid` by `recompute_claim_from_payments` when `sum(paid) > 0`. Neither re-evaluates blockers — correctly so for `paid`, but it means the same render-time blocker badge appears on claims that already left the pre-submit gate. A claim can be submitted with unresolved soft/hard blockers whenever it was queued from a path that skipped `PreSubmitChecklist`.

### "Nothing in Needs Correction / Needs Review"
Not a value mismatch — the strings match the enum exactly everywhere. The tabs are empty because **nothing in this tenant's data has ever been written to those values**. Live data confirms it:

`select status, count(*) from claim_records group by 1` → `paid 7, denied 6, submitted 5, ready_to_bill 4`. Zero `needs_review`, zero `needs_correction`. 21 of the 22 rows carry `notes = 'Simulation Lab Tier 1 demo seed'` — i.e. the entire board is Simulation Lab seed data, which only ever writes `ready_to_bill / submitted / paid / denied`. The seeder has no bucket for `needs_review` or `needs_correction`.

The only writers of `needs_review` are client-side (`BillingAndClaims.tsx:602, 773, 984, 1185`), triggered by Sync/Refresh; `needs_correction` only comes from ack ingestion or an 835 reversal. None of those have fired here.

## 4. Categorization gap — confirmed

| Stage | Writer | Blocker-checked? |
| --- | --- | --- |
| Claim creation on PCR submit | DB trigger, hardcoded `ready_to_bill` | **No** |
| Sim Lab seed | edge function, hardcoded statuses | **No** |
| Secondary claim | `create-secondary-claim.ts:134` | **No** |
| Manual Sync from trips | `buildClaimFromTrip:602` | Yes (`computeCleanTripStatus`) |
| Manual Refresh | `refreshExistingClaims:771-774` | Yes |
| Submission queue | `queue-claims-for-submission.ts:498-542` | Payer mapping only |
| Remittance/ack | `recompute_claim_from_payments`, `ingest-acks-officeally` | N/A (payer-driven) |

The trigger and the client Sync disagree on the same claim: the trigger says `ready_to_bill` and clears the trip's `blockers` array; a later Sync can flip the same claim to `needs_review`. Whichever ran last wins. That's the "things just land with no categorizing" behaviour.

## 5. Mutual exclusivity

Tabs are strictly mutually exclusive — single-field equality on `c.status`, so a claim appears in at most one tab. The real problem is the opposite: with four enum values having no tab, a claim can appear in **zero** tabs while still counting toward the fetched 1000-row set, and a claim's bucket can contradict its blocker state because blockers are cosmetic at render time.

## Inconsistencies to flag

1. Trigger-created claims bypass every readiness rule and are stamped `ready_to_bill`.
2. The trigger also wipes `trip_records.blockers` and `billing_blocked_reason`, destroying the upstream signal the Trip Queue relies on.
3. `pending`, `reversal`, `forwarded`, `blocked_payer_mapping` are unreachable in the UI.
4. Local `ClaimStatus` type (line 99) is narrower than the DB enum, so those four values are cast-invisible to TypeScript.
5. `needs_review` is only ever produced by a manual button press, so the tab is structurally empty in normal operation.
6. Blocker detection runs at render only (line 1705) and never influences status or bucket.
