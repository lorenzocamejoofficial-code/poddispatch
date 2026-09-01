# Diagnosis: blocked claims in Ready to Bill

## What the data says (read-only evidence)

Actual `claim_records.status` for the named patients (queried just now):

| Patient | Run date | Status | icd10 | origin_type | dest_type |
|---|---|---|---|---|---|
| Margaret Davis | 2025-09-09 | `ready_to_bill` | null | null | null |
| Patricia Williams | 2025-09-06 | `ready_to_bill` | null | null | null |
| Robert Henderson | 2025-08-17 | `ready_to_bill` | null | null | null |
| Margaret Whitfield | 2026-05-30 | `ready_to_bill` | N18.6, Z99.2 | Residence | Dialysis Facility |
| (other Davis/Williams/Whitfield/Henderson rows) | 2026-07/08 | paid / denied / needs_correction | — | — | — |

So this is **case 4a**: their status genuinely IS `ready_to_bill`, the tab mapping is correct, and the red BLOCKED badge is honest render-time detection. Whitfield's 2026-05-30 claim is complete and legitimately belongs in the tab — that is the 4th card.

## Root cause: the Simulation Lab seeder, not the trigger and not auto-promotion

1. **Trigger is correct.** The live body of `auto_create_claim_on_pcr_submit` inserts `'needs_review'::claim_status` (line 123 of the live function definition). It is not the source. The "3 new claims just arrived" banner is the just-arrived ribbon reacting to the seed run, not to a trigger insert with a bad status.
2. **Auto-promotion is not over-promoting.** `src/pages/BillingAndClaims.tsx:845-881` only reads `needs_review` rows and only writes when `gateResult.level === "clean" && !addressIssue`. These three rows were never `needs_review`.
3. **The seeder writes `ready_to_bill` directly.** `supabase/functions/simulation-lab/index.ts` Bucket 4 ("timely filing", lines ~1863-1880) force-stamps `status: "ready_to_bill"` with `run_date` 357/360/380 days back and `payer_type: medicare` — while leaving the underlying pool rows with **no ICD-10, no origin_type, no destination_type**. All three rows were created and updated in the same seed run (created 01:34:58, updated 01:35:02).

Result: the seeder bypasses the readiness gate that every other writer now respects, so blocked claims land in Ready to Bill.

## Fix

**Part 1 — seeder writes honest, complete demo data (the actual cause)**

In `supabase/functions/simulation-lab/index.ts`, Bucket 4 (timely filing): before stamping `ready_to_bill`, fill in the fields a clean Medicare claim requires — `icd10_codes` (dialysis-appropriate, e.g. N18.6 / Z99.2 matching the trip), `origin_type`, `destination_type`, origin/destination address + ZIP, and `member_id` — so the claims are genuinely clean claims that happen to be near/past the filing deadline. That is what the bucket is meant to demo. The 380-day "past due" claim stays `ready_to_bill` (timely filing is a warning surfaced by the filing strip, not a hard blocker), and its remaining data is complete.

Same audit pass over the other buckets that stamp `ready_to_bill` or `submitted` on incomplete pool rows, so no seeded claim sits in a bucket its data contradicts. Buckets 6/7 (needs_review / needs_correction) keep their intentional gaps — those are honest.

**Part 2 — symmetric demotion guard (safety net, one source of truth)**

Add a `demoteBlockedReadyToBill` pass next to `autoPromoteNeedsReview` in `src/pages/BillingAndClaims.tsx`, reusing the **same** `buildClaimFromTrip` gate — no duplicated blocker logic. It reads only `ready_to_bill` rows, and when the gate returns a hard-blocked result it writes `status: "needs_review"` (guarded by `.eq("status", "ready_to_bill")`). One-directional, status field only. This makes any future writer that stamps `ready_to_bill` dishonestly self-correct instead of surfacing a BLOCKED card in Ready to Bill.

## Out of scope / untouched

Pricing, 837 export, the submit path, denial recovery, the `needs_correction` fix, and `claim-status-tabs.ts` (mapping verified correct).

## Verification

- Re-run the full test suite; parity tests must stay green.
- Re-seed the sim company, then query the four named claims and report before/after status.
- Query that every `ready_to_bill` claim in the tenant has ICD-10, origin_type and destination_type populated.
