# Fix the `needs_correction` dead-end after denial recovery

## Is `needs_correction` load-bearing?

Yes — but **only as an inbound payer-driven state, never as an outbound "worked and ready" state.** Everything that writes it comes from the payer side:

- `recompute_claim_from_payments` trigger (migration `20260519162738...sql:107-119`) sets `needs_correction` when a remittance reverses a payment or pays nothing.
- Office Ally 277CA/999 ack ingestion (`supabase/functions/ingest-acks-officeally/index.ts:213, :297`) sets it on a front-end rejection.
- Auto 835 retrieval fallback (`retrieve-remittance-officeally/index.ts:312`) for any CLP status that isn't clearly paid or denied.
- 835 parser status map (`src/lib/edi-835-parser.ts:392, :396`).

Everything that reads it treats it as **open, unworked A/R**:

- AR aging buckets (`src/lib/billing-utils.ts:667`) count `submitted` + `needs_correction` as outstanding money.
- Billing Work Queue (`src/components/billing/BillingWorkQueue.tsx:66, :167`).
- `generate_biller_tasks` timely-filing risk task (`20260414035544...sql:160`, `20260519162738...sql:218`) fires only for `submitted`/`needs_correction`.
- Pipeline header marks it `attention: true` (`BillingPipelineHeader.tsx:22`); `classify-denial.ts:225` treats it as "review".

So the current behavior is actively wrong in two ways: a fully-worked denial is filed under "payer sent it back, still needs work," it inflates AR aging, and it can never be submitted (bulk submit filters `ready_to_bill` only — `BillingAndClaims.tsx:469`; single Submit button only renders for `ready_to_bill` — `:2004`). Nothing else *depends* on a worked denial passing through `needs_correction` — no trigger, report, or filter needs that hop.

**Verdict: `needs_correction` is load-bearing for inbound payer states, and an unnecessary intermediate for outbound worked denials. It is the cause of the dead-end.**

## Recommendation: Option A

Set `ready_to_bill` directly in `handleMarkReady` when the live blocker gate passes.

Why A over B:
- The gate has already run (`fetchClaimBlockerSnapshot` re-read seconds earlier, `DenialRecoveryEngine.tsx:369-379`) — the claim is, by the app's own definition, clean. `ready_to_bill` is the truthful state.
- B would mean teaching two separate submit surfaces (bulk filter + single button) plus the queue path to accept a second status and re-run blockers at submit time — more code, two places to drift, and it leaves the claim mis-counted in AR aging and biller tasks in the meantime.
- A keeps `needs_correction` meaning exactly one thing: *the payer sent this back and it hasn't been worked yet.* Cleaner semantics, no change to how `ready_to_bill` claims submit.
- Risk check: no trigger fires on a `claim_records` status update, so writing `ready_to_bill` won't be clobbered. `recompute_claim_from_payments` only runs on new `claim_payments` rows — i.e. if a *new* remittance arrives, which should override the status anyway.

## The change

**`src/components/billing/DenialRecoveryEngine.tsx` — `handleMarkReady` (~365-433)**

1. Keep the existing hard gate unchanged: re-read blockers, bail with the current error toast if any remain, still require correction notes. No change to blocker rules.
2. After the gate passes and field corrections save, write `status: "ready_to_bill"` instead of `"needs_correction"` (`:392`), alongside the unchanged `resubmission_count` bump and `resubmitted_at` stamp.
3. Update the audit-log `newData` (`:426`) to record `status: "ready_to_bill"` so the log matches what was actually written.

**Partial-work path (new, small):** the "Save Progress" button already exists for partial work and only writes an `ar_followup_notes` `[PROGRESS]` note — it does not touch status. That stays as-is, so a partially-worked denial simply remains `denied` and keeps showing in the denial queue. No new status writes.

**Submit filters:** unchanged. Once the claim is `ready_to_bill` it flows through the existing bulk submit and single-claim Submit button with no modification.

## Messaging

- Blocker gate fails (unchanged behavior, existing copy is already accurate): "N claim blockers still open — fix them before resubmitting, or this claim will just be denied again."
- Missing correction notes (unchanged): "Correction notes are required before resubmission."
- Success (replaces the overstated "Claim marked ready for resubmission"): **"Claim is ready to resubmit — send it from the Ready to Bill tab."** Plus a short secondary line noting how many fields were corrected when `changesCount > 0`.

## Counters, notes, audit — all preserved

Every one of these stays exactly where it is in `handleMarkReady`, unconditional on the resulting status:
- `resubmission_count` + 1 and `resubmitted_at` timestamp — same update call as the status write.
- `[RESUBMIT]` note inserted into `ar_followup_notes` with denial code, notes, and corrected-field count.
- `biller_tasks` auto-complete for `denial_unworked` tasks on that claim.
- `logAuditEvent` entry (with the corrected `newData.status`).
- `saveFieldCorrections()` still runs before the status write.

## Out of scope (untouched)

835 parser and Office Ally auto-retrieval, blocker rules themselves, and the existing `ready_to_bill` submission path.
