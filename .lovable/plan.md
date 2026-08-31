# Honest Claim Status — structural billing fix

Goal: a claim's `status` becomes a truthful verdict about its real state, written the same way by every code path, so no tab ever contradicts the claim's blockers and no claim is invisible.

## Key finding that shapes the design

Blocker logic lives entirely in TypeScript: `src/lib/claim-readiness.ts` `evaluateClaimReadiness()` has ~25 hard-block rules (lines 335-720) covering member ID, service date, charges, HCPCS, payer, ICD-10, patient name/DOB/sex/address, timely filing, origin/destination type and ZIP, PCS window, RSNAT auth, hospice. There is **no** SQL equivalent — no readiness function exists in the database.

Re-implementing those 25 rules in PL/pgSQL would create a second source of truth that drifts the first time either side changes. So we do **not** do that.

**Recommended approach — "pessimistic trigger, TS promotes":**

- The DB trigger stops asserting cleanliness. New claims are created as `needs_review`.
- The existing TypeScript readiness gate (`buildClaimFromTrip`, `refreshExistingClaims`) is the *only* thing that can promote a claim to `ready_to_bill`.
- That promotion pass runs automatically when the Billing & Claims page loads (today it only runs on a manual Sync/Refresh button), so a clean claim reaches Ready to Bill within seconds of the page opening — no extra work for the biller.

This keeps exactly one blocker implementation, and it fails *safe*: a claim never sits in Ready to Bill because nobody checked it.

---

## Part 1 — Claim-creation trigger (root cause)

Migration to `auto_create_claim_on_pcr_submit`:

1. Insert status becomes `'needs_review'::claim_status` instead of the hardcoded `'ready_to_bill'` (function body line 117). The `ON CONFLICT DO UPDATE` branch is left alone so it never downgrades a claim a biller already advanced.
2. Stop wiping the upstream signal. Today the trigger sets `claim_ready = true`, `billing_blocked_reason = NULL`, `blockers = '{}'` on the trip (lines 142-150). **Preserving it is needed** — the Trip Queue (`BillingQueueView.computeQueueDetails`) reads `trip_records.blockers` / `billing_blocked_reason` / `claim_ready` as its single source of truth, so wiping them makes a blocked trip look clean in two places at once. Change to:
   - `claim_creation_status = 'created'` (keep)
   - trip `status` completed → `ready_for_billing` (keep)
   - `claim_ready`, `blockers`, `billing_blocked_reason` — **left untouched**, whatever the PCR-submit path already computed stays.
3. No other behaviour in the trigger changes: pricing, HCPCS derivation, modifiers, facility lookup, failure logging, simulation columns all stay byte-for-byte.

## Part 2 — Align the other `ready_to_bill` writers

**`src/lib/create-secondary-claim.ts:134`** — change `status: "ready_to_bill"` to `"needs_review"`. Same rationale: the secondary inherits the primary's data and has its own payer/member-ID exposure; the TS readiness pass promotes it once clean. No pricing or payer-derivation change.

**`supabase/functions/simulation-lab/index.ts`** — seed data stays hardcoded (it is demo data by design), but the spread becomes realistic. Re-slice the existing claim pool to add two new buckets:
- 3 claims at `needs_review` with deliberately incomplete data (missing member ID, missing ICD-10, missing patient address) so the render-time blocker badge has something real to show.
- 2 claims at `needs_correction` with an ack-style rejection reason, mirroring what `ingest-acks-officeally` writes.
- Existing buckets (paid, paid-with-secondary, aging submitted, timely filing, underpaid, denied) keep their current counts; the pool slices shift, nothing else changes. `is_simulated` / `simulation_run_id` / `is_test_submission` guards are preserved exactly as they are.

**`buildClaimFromTrip` (line 602) and `refreshExistingClaims` (771-774)** — unchanged. They are the correct pattern. One addition: `refreshExistingClaims`'s promotion pass gets an auto-invoked variant on Billing page mount, scoped to `needs_review` claims only, silent (no toast), so newly created claims settle into the right bucket without a button press.

## Part 3 — Homing the four orphan statuses

`pending`, `reversal`, `forwarded`, `blocked_payer_mapping` currently render nowhere.

Options considered:
- **A. Six new tabs** — twelve pills across the top; unreadable, and a biller does not think in ten buckets.
- **B. Fold into existing buckets with a sub-label** — recommended.
- C. One catch-all "Other" tab — leaves the biller guessing what is in it.

**Recommended (B):**

| Enum value | Tab it appears in | Sub-label on the card |
| --- | --- | --- |
| `pending` | Submitted | "In process at payer" |
| `forwarded` | Submitted | "Forwarded to secondary" |
| `reversal` | Needs Correction | "Payment reversed" |
| `blocked_payer_mapping` | Needs Review | "Payer not mapped" |

Implementation: replace the six `c.status === col.status` equality checks with a `STATUS_TO_TAB` map (`Record<ClaimStatus, TabKey>`) that covers all ten enum values, used identically by `BillingAndClaims.tsx:1546-1550` and `BillingPipelineHeader.tsx:40-43`. Membership is still driven purely by status — just via a total map instead of a partial equality, so no value can fall through.

Also widen `ClaimStatus` at `src/pages/BillingAndClaims.tsx:99` to the full ten-value enum (sourced from the generated DB enum type) so TypeScript stops hiding the four extras. The status-edit dropdown in the claim dialog keeps offering only the six manually-settable values — payer-driven statuses stay read-only.

## Part 4 — Tabs stay status-driven

No blocker-based filter is added anywhere. Tabs continue to bucket on `status` alone. After Parts 1-3:

- A claim with unresolved hard blockers is created as `needs_review`, the promotion pass refuses to upgrade it, so it appears in **Needs Review** — never Ready to Bill.
- A claim in Ready to Bill has, by construction, passed `evaluateClaimReadiness` with zero `severity: "block"` issues.
- The render-time blocker badge (`BillingAndClaims.tsx:1705`) stays as detail, and now agrees with the bucket instead of contradicting it.
- Buckets remain mutually exclusive: the status→tab map is a function, so every claim lands in exactly one tab, and every enum value has a destination.

## Migration & backfill safety

**Recommended: new claims gate correctly; existing claims are left untouched.**

- The migration only replaces the trigger function body. It runs no `UPDATE` against `claim_records`.
- Existing `ready_to_bill` claims keep that status and stay exactly where the biller expects them. They get re-evaluated only if the biller presses Sync/Refresh or the auto-promotion pass touches them — and that pass only reads `needs_review` claims, so it can never demote a claim out of Ready to Bill.
- Submitted / paid / denied claims are never re-evaluated (the existing `upgradable` guard at line 771 already excludes them).
- Worst realistic case for a new claim: it sits in Needs Review for the seconds until the Billing page's promotion pass runs. It cannot be silently lost, because Needs Review is a visible tab with a count.
- Nothing is touched in: charge/rate calculation, HCPCS or modifier derivation, the 837P generator, `queue-claims-for-submission`, the Denial Recovery Engine, the `needs_correction` resubmission fix, remittance posting, or any simulation guard.

## Verification before I report done

- `bunx vitest run` — full suite including `claim-parity.test.ts` and `remittance-parity.test.ts` must stay green (proves EDI output is byte-identical).
- Confirm via a database read that the new trigger produces `needs_review` on a fresh PCR submit and that the trip's `blockers` array survives.
- Confirm all ten enum values map to a tab and the six tab counts sum to the total claim count.
